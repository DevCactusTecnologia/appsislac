// Store de recoletas (`recoletas`).
// Cada recoleta vincula-se a um exame específico (atendimento_exame_id) e captura:
// motivo, etapa em que foi detectada, solicitante, observação, status.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type RecoletaEtapa = "coleta" | "triagem" | "analise" | "liberacao";
export type RecoletaStatus = "pendente" | "realizada" | "cancelada";

export interface Recoleta {
  id: string;
  atendimentoId: number;
  atendimentoExameId: number;
  exameNome: string;
  pacienteNome: string;
  protocolo: string;
  motivoId: string | null;
  motivoNome: string;
  etapa: RecoletaEtapa;
  status: RecoletaStatus;
  observacao: string;
  solicitanteEmail: string;
  dataSolicitacao: string;
  dataNovaColeta: string | null;
}

let _cache: Recoleta[] = [];
let _loaded = false;
const _listeners = new Set<() => void>();
const _emit = () => _listeners.forEach((fn) => { try { fn(); } catch (e) { showError(e, { scope: "recoletasStore.emit", silent: true }); } });

function mapRow(r: any): Recoleta {
  return {
    id: r.id,
    atendimentoId: r.atendimento_id,
    atendimentoExameId: r.atendimento_exame_id,
    exameNome: r.exame_nome ?? "",
    pacienteNome: r.paciente_nome ?? "",
    protocolo: r.protocolo ?? "",
    motivoId: r.motivo_id ?? null,
    motivoNome: r.motivo_nome ?? "",
    etapa: r.etapa,
    status: r.status,
    observacao: r.observacao ?? "",
    solicitanteEmail: r.solicitante_email ?? "",
    dataSolicitacao: r.data_solicitacao,
    dataNovaColeta: r.data_nova_coleta ?? null,
  };
}

export async function loadRecoletas(): Promise<void> {
  const { data, error } = await supabase
    .from("recoletas")
    .select("*")
    .order("data_solicitacao", { ascending: false });
  if (error) { showError(error, { scope: "recoletasStore.load", silent: true }); return; }
  _cache = (data ?? []).map(mapRow);
  _loaded = true;
  _emit();
}

export function getRecoletas(): Recoleta[] { return _cache; }
export function isRecoletasLoaded(): boolean { return _loaded; }
export function subscribeRecoletas(fn: () => void): () => void {
  _listeners.add(fn); return () => { _listeners.delete(fn); };
}

export interface CriarRecoletaInput {
  atendimentoId: number;
  atendimentoExameId: number;
  exameNome: string;
  pacienteNome: string;
  protocolo: string;
  motivoId: string | null;
  motivoNome: string;
  etapa: RecoletaEtapa;
  observacao?: string;
  solicitanteEmail?: string;
}

export async function criarRecoleta(input: CriarRecoletaInput): Promise<Recoleta> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) throw new Error("tenant não identificado");
  const data = await persistOneOrThrow<any>(
    supabase.from("recoletas").insert({
      tenant_id: tenantId,
      atendimento_id: input.atendimentoId,
      atendimento_exame_id: input.atendimentoExameId,
      exame_nome: input.exameNome,
      paciente_nome: input.pacienteNome,
      protocolo: input.protocolo,
      motivo_id: input.motivoId,
      motivo_nome: input.motivoNome,
      etapa: input.etapa,
      observacao: input.observacao ?? "",
      solicitante_email: input.solicitanteEmail ?? "",
      status: "pendente",
    }),
    "recoletas.criar",
  );
  const novo = mapRow(data);
  _cache = [novo, ..._cache];
  _emit();
  return novo;
}

export async function atualizarStatusRecoleta(id: string, status: RecoletaStatus): Promise<void> {
  const patch: any = { status };
  if (status === "realizada") patch.data_nova_coleta = new Date().toISOString();
  await persistOrThrow(
    supabase.from("recoletas").update(patch).eq("id", id),
    "recoletas.atualizarStatus",
  );
  await loadRecoletas();
}

export async function _initRecoletasStore(): Promise<void> {
  await loadRecoletas();
}

// ── Métricas agregadas (lado-cliente) ──
export interface MetricasRecoleta {
  total: number;
  pendentes: number;
  realizadas: number;
  canceladas: number;
  porEtapa: Record<RecoletaEtapa, number>;
  porMotivo: Array<{ nome: string; total: number }>;
}

export function calcularMetricas(lista: Recoleta[]): MetricasRecoleta {
  const porEtapa: Record<RecoletaEtapa, number> = { coleta: 0, triagem: 0, analise: 0, liberacao: 0 };
  const porMotivoMap = new Map<string, number>();
  let pendentes = 0, realizadas = 0, canceladas = 0;
  for (const r of lista) {
    porEtapa[r.etapa] = (porEtapa[r.etapa] ?? 0) + 1;
    porMotivoMap.set(r.motivoNome, (porMotivoMap.get(r.motivoNome) ?? 0) + 1);
    if (r.status === "pendente") pendentes++;
    else if (r.status === "realizada") realizadas++;
    else if (r.status === "cancelada") canceladas++;
  }
  const porMotivo = [...porMotivoMap.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
  return { total: lista.length, pendentes, realizadas, canceladas, porEtapa, porMotivo };
}
