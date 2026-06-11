// Store de orçamentos com cache síncrono backed by Supabase.
// Preserva 100% da API pública legada: getOrcamentos, addOrcamento,
// markAsConverted, subscribeOrcamentos.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface Orcamento {
  id: string;            // = codigo (ORC-2026-XXXX)
  data: string;          // dd/mm/yyyy HH:mm:ss
  nome: string;
  cpf: string;
  telefone: string;
  convenio: string;
  solicitante: string;
  exames: string[];
  subtotal: number;
  desconto: number;
  total: number;
  convertido: boolean;
}

let _orcamentos: Orcamento[] = [];
let _listeners: Array<() => void> = [];
let _counter = 0;
// Map codigo -> id numérico do banco (para updates)
const _idByCodigo = new Map<string, number>();

function notify() {
  _listeners.forEach((fn) => fn());
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("pt-BR");
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date} ${time}`;
}

function buildFromRows(orcRow: any, examesRows: any[]): Orcamento {
  return {
    id: orcRow.codigo,
    data: formatDateBR(orcRow.created_at || orcRow.data),
    nome: orcRow.paciente_nome,
    cpf: orcRow.paciente_cpf || "",
    telefone: orcRow.paciente_telefone || "",
    convenio: orcRow.convenio_nome || "Particular",
    solicitante: orcRow.solicitante || "",
    exames: examesRows
      .filter((e) => e.orcamento_id === orcRow.id)
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((e) => e.nome_exame),
    subtotal: Number(orcRow.subtotal) || 0,
    desconto: Number(orcRow.desconto) || 0,
    total: Number(orcRow.total) || 0,
    convertido: !!orcRow.convertido,
  };
}

export async function _initOrcamentosStore(): Promise<void> {
  const [{ data: orcs, error: e1 }, { data: itens, error: e2 }] = await Promise.all([
    supabase.from("orcamentos").select("*").order("created_at", { ascending: false }),
    supabase.from("orcamento_exames").select("*"),
  ]);

  if (e1) {
    showError(e1, { scope: "orcamentoStore.init.orcamentos", silent: true });
    return;
  }
  if (e2) {
    showError(e2, { scope: "orcamentoStore.init.itens", silent: true });
  }

  const examesArr = itens ?? [];
  _orcamentos = (orcs ?? []).map((row: any) => {
    _idByCodigo.set(row.codigo, row.id);
    return buildFromRows(row, examesArr);
  });

  // Inicializa contador a partir do maior numero ORC-2026-XXXX existente.
  let maxN = 0;
  for (const o of _orcamentos) {
    const m = /ORC-\d{4}-(\d+)/.exec(o.id);
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
  }
  _counter = maxN;

  notify();
}

export function getOrcamentos(): Orcamento[] {
  return _orcamentos;
}

export async function addOrcamento(orc: Omit<Orcamento, "id" | "convertido">): Promise<string> {
  // Código provisório otimista. O código oficial é gerado server-side via trigger
  // (formato ORC-AAAA-NNNNNNN) e sincronizado após a inserção.
  _counter++;
  const codigoProvisorio = `ORC-TMP-${Date.now()}-${_counter}`;

  // Otimista
  const novo: Orcamento = { ...orc, id: codigoProvisorio, convertido: false };
  _orcamentos = [novo, ..._orcamentos];
  notify();

  try {
    const tenantId = await getCurrentTenantId();
    let iso = new Date().toISOString();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(orc.data);
    if (m) {
      const [, dd, mm, yyyy] = m;
      iso = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`).toISOString();
    }

    const insOrc = await persistOneOrThrow<{ id: number; codigo: string }>(
      supabase
        .from("orcamentos")
        .insert({
          tenant_id: tenantId,
          codigo: codigoProvisorio,
          data: iso,
          paciente_nome: orc.nome,
          paciente_cpf: orc.cpf || "",
          paciente_telefone: orc.telefone || "",
          convenio_nome: orc.convenio || "Particular",
          solicitante: orc.solicitante || "",
          subtotal: orc.subtotal,
          desconto: orc.desconto,
          total: orc.total,
          convertido: false,
        }),
      "orcamentos.criar",
      { selectCols: "id, codigo" },
    );

    const codigoOficial = insOrc.codigo;
    _idByCodigo.set(codigoOficial, insOrc.id);
    _orcamentos = _orcamentos.map((o) =>
      o.id === codigoProvisorio ? { ...o, id: codigoOficial } : o,
    );
    notify();

    if (orc.exames.length > 0) {
      const rows = orc.exames.map((nome, ordem) => ({
        tenant_id: tenantId,
        orcamento_id: insOrc.id,
        nome_exame: nome,
        ordem,
      }));
      try {
        await persistOrThrow(
          supabase.from("orcamento_exames").insert(rows),
          "orcamentos.criarExames",
          { expectAtLeast: rows.length },
        );
      } catch (e) {
        // Rollback do cabeçalho para manter consistência
        await supabase.from("orcamentos").delete().eq("id", insOrc.id);
        _orcamentos = _orcamentos.filter((o) => o.id !== codigoOficial);
        _idByCodigo.delete(codigoOficial);
        notify();
        throw e;
      }
    }

    return codigoOficial;
  } catch (err) {
    _orcamentos = _orcamentos.filter((o) => o.id !== codigoProvisorio);
    notify();
    throw err;
  }
}

/**
 * Atualiza desconto e total de um orçamento (otimista + persistente).
 * @param id  Código do orçamento (ORC-YYYY-XXXX)
 * @param desconto  Novo valor de desconto em R$
 * @param total  Novo valor total (subtotal - desconto), já calculado pelo caller
 */
export async function updateOrcamentoDesconto(id: string, desconto: number, total: number): Promise<void> {
  const prev = _orcamentos.find((o) => o.id === id);
  if (!prev) return;
  const prevDesc = prev.desconto;
  const prevTotal = prev.total;

  _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, desconto, total } : o));
  notify();

  const dbId = _idByCodigo.get(id);
  if (!dbId) {
    _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, desconto: prevDesc, total: prevTotal } : o));
    notify();
    throw new Error(`Orçamento ${id} sem id no cache local`);
  }

  try {
    await persistOneOrThrow(
      supabase.from("orcamentos").update({ desconto, total }).eq("id", dbId),
      "orcamentos.atualizarDesconto",
    );
  } catch (err) {
    _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, desconto: prevDesc, total: prevTotal } : o));
    notify();
    throw err;
  }
}

export async function markAsConverted(id: string): Promise<void> {
  _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, convertido: true } : o));
  notify();

  const dbId = _idByCodigo.get(id);
  if (!dbId) {
    _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, convertido: false } : o));
    notify();
    throw new Error(`Orçamento ${id} sem id no cache local`);
  }

  try {
    await persistOneOrThrow(
      supabase.from("orcamentos").update({ convertido: true }).eq("id", dbId),
      "orcamentos.marcarConvertido",
    );
  } catch (err) {
    _orcamentos = _orcamentos.map((o) => (o.id === id ? { ...o, convertido: false } : o));
    notify();
    throw err;
  }
}

export function subscribeOrcamentos(listener: () => void) {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}
