// Store de pacientes baseado em Supabase (cache síncrono).
// API pública preservada para consumers que fazem leitura sincrona.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { persistOneOrThrow, PersistError } from "@/lib/persist";
import { showError } from "@/lib/showError";
import { formatDateBR } from "@/lib/dateBR";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type PacienteRow = Tables<"pacientes">;
type PacienteInsert = TablesInsert<"pacientes">;
type PacienteUpdate = TablesUpdate<"pacientes">;

export interface Paciente {
  id: number;
  friendlyId?: string;
  nome: string;
  nomeSocial?: string;
  cpf: string;            // formato com máscara: "000.000.000-00" (opcional)
  dataNascimento: string; // formato dd/MM/yyyy
  sexo: string;           // "Masculino" | "Feminino" (compat) — DB armazena "M" | "F"
  telefone: string;
  email: string;
  status: "Ativo" | "Inativo";
  // Campos opcionais (endereço/celular) usados pelo formulário
  celular?: string;
  cep?: string;
  estado?: string;
  cidade?: string;
  bairro?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  // Dados do responsável legal (exibidos quando paciente é menor de idade)
  guardianName?: string;
  guardianCpf?: string;
  // LGPD
  consentimentoLgpd?: boolean;
  consentimentoEm?: string; // ISO timestamp
  // Derivados (mantidos para compat com consumers antigos)
  idade?: string;
  initials?: string;
}

let _pacientes: Paciente[] = [];
let _listeners: Array<() => void> = [];

const formatCPF = (digits: string): string => {
  const raw = (digits || "").replace(/\D/g, "");
  if (!raw) return "";
  const d = raw.padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};


const dateBRtoISO = (br: string | undefined): string | null => {
  if (!br) return null;
  const parts = br.split("/");
  if (parts.length !== 3) return null;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
};

const sexoToLong = (s: string): string => (s === "M" ? "Masculino" : s === "F" ? "Feminino" : s);
const sexoToShort = (s: string): string => (s === "Masculino" ? "M" : s === "Feminino" ? "F" : s);

const initials = (nome: string): string =>
  nome.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();

function fromRow(r: PacienteRow): Paciente {
  return {
    id: Number(r.id),
    friendlyId: (r as unknown as { friendly_id?: string }).friendly_id || "",
    nome: r.nome,
    nomeSocial: (r as unknown as { nome_social?: string | null }).nome_social || "",
    cpf: formatCPF(r.cpf || ""),
    dataNascimento: formatDateBR(r.data_nascimento),
    sexo: sexoToLong(r.sexo),
    telefone: r.telefone || "",
    email: r.email || "",
    status: (r.status === "Ativo" ? "Ativo" : "Inativo"),
    celular: r.celular || "",
    cep: r.cep || "",
    estado: r.estado || "",
    cidade: r.cidade || "",
    bairro: r.bairro || "",
    endereco: r.endereco || "",
    numero: r.numero || "",
    complemento: r.complemento || "",
    guardianName: (r as unknown as { guardian_name?: string | null }).guardian_name || "",
    guardianCpf: (r as unknown as { guardian_cpf?: string | null }).guardian_cpf
      ? formatCPF(((r as unknown as { guardian_cpf: string }).guardian_cpf).replace(/\D/g, ""))
      : "",
    consentimentoLgpd: Boolean((r as unknown as { consentimento_lgpd?: boolean }).consentimento_lgpd),
    consentimentoEm: (r as unknown as { consentimento_em?: string | null }).consentimento_em ?? undefined,
    initials: initials(r.nome),
  };
}

function toRow(p: Partial<Paciente>): PacienteUpdate {
  const row: PacienteUpdate = {};
  if (p.nome !== undefined) row.nome = p.nome;
  if (p.nomeSocial !== undefined) (row as Record<string, unknown>).nome_social = p.nomeSocial ? p.nomeSocial : null;
  if (p.cpf !== undefined) row.cpf = p.cpf ? p.cpf.replace(/\D/g, "") : null;
  if (p.dataNascimento !== undefined) row.data_nascimento = dateBRtoISO(p.dataNascimento);
  if (p.sexo !== undefined) row.sexo = sexoToShort(p.sexo);
  if (p.telefone !== undefined) row.telefone = p.telefone;
  if (p.celular !== undefined) row.celular = p.celular;
  if (p.email !== undefined) row.email = p.email;
  if (p.cep !== undefined) row.cep = p.cep;
  if (p.estado !== undefined) row.estado = p.estado;
  if (p.cidade !== undefined) row.cidade = p.cidade;
  if (p.bairro !== undefined) row.bairro = p.bairro;
  if (p.endereco !== undefined) row.endereco = p.endereco;
  if (p.numero !== undefined) row.numero = p.numero;
  if (p.complemento !== undefined) row.complemento = p.complemento;
  if (p.status !== undefined) row.status = p.status;
  if (p.guardianName !== undefined) {
    (row as Record<string, unknown>).guardian_name = p.guardianName ? p.guardianName : null;
  }
  if (p.guardianCpf !== undefined) {
    const digits = (p.guardianCpf || "").replace(/\D/g, "");
    (row as Record<string, unknown>).guardian_cpf = digits ? digits : null;
  }
  if (p.consentimentoLgpd !== undefined) {
    (row as Record<string, unknown>).consentimento_lgpd = !!p.consentimentoLgpd;
  }
  if (p.consentimentoEm !== undefined) {
    (row as Record<string, unknown>).consentimento_em = p.consentimentoEm || null;
  }
  return row;
}

function notify() { _listeners.forEach(fn => fn()); }

// TTL curto em sessionStorage: evita refetch a cada F5/abertura de aba.
// Chave por tenant; só salva snapshot abaixo do hard-cap (proteção LGPD/quota).
const PACIENTES_CACHE_TTL_MS = 90_000;
const PACIENTES_CACHE_MAX_ROWS = 4000;
function _cacheKey(tid: string | null): string {
  return `pacientes:snap:${tid ?? "anon"}`;
}
function _loadCachedSnapshot(tid: string | null): Paciente[] | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(_cacheKey(tid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; rows: Paciente[] };
    if (!parsed?.ts || Date.now() - parsed.ts > PACIENTES_CACHE_TTL_MS) return null;
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch { return null; }
}
function _saveCachedSnapshot(tid: string | null, rows: Paciente[]): void {
  try {
    if (typeof window === "undefined") return;
    if (rows.length > PACIENTES_CACHE_MAX_ROWS) return;
    window.sessionStorage.setItem(_cacheKey(tid), JSON.stringify({ ts: Date.now(), rows }));
  } catch { /* quota / serialize falhou: silencioso */ }
}

export async function _initPacientesStore(): Promise<void> {
  // Tenta hidratar do cache sessionStorage antes de bater no banco.
  let tenantId: string | null = null;
  try { tenantId = await getCurrentTenantId(); } catch { /* segue sem cache */ }
  const cached = _loadCachedSnapshot(tenantId);
  if (cached) {
    _pacientes = cached;
    notify();
    return;
  }

  // Slim select (P2-E): apenas colunas mapeadas por fromRow.
  // Paginação por range para contornar o limite default de 1000 linhas
  // do PostgREST e suportar tenants com grande volume de pacientes.
  const cols =
    "id,friendly_id,nome,cpf,data_nascimento,sexo,telefone,email,status," +
    "celular,cep,estado,cidade,bairro,endereco,numero,complemento," +
    "guardian_name,guardian_cpf,consentimento_lgpd,consentimento_em,nome_social";
  // Cursor pagination por (nome, id) — evita o custo de OFFSET em páginas
  // profundas (com OFFSET, o Postgres precisa varrer+descartar N linhas a
  // cada range). O cursor composto usa `id` como tie-breaker estável para
  // empates de `nome`. Mantém ORDER BY (nome, id) para casar com índice.
  const PAGE = 1000;
  const all: PacienteRow[] = [];
  let lastNome: string | null = null;
  let lastId: number | null = null;
  for (;;) {
    let q = supabase
      .from("pacientes")
      .select(cols)
      .order("nome", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE);
    if (lastNome !== null && lastId !== null) {
      // (nome > lastNome) OR (nome = lastNome AND id > lastId)
      // Escape de vírgula/parêntese no nome para o parser do PostgREST.
      const safeNome = lastNome.replace(/[,()"]/g, "");
      q = q.or(`nome.gt.${safeNome},and(nome.eq.${safeNome},id.gt.${lastId})`);
    }
    const { data, error } = await q;
    if (error) {
      showError(error, { scope: "pacienteStore.init", silent: true });
      return;
    }
    const batch = (data ?? []) as unknown as PacienteRow[];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE) break;
    const last = batch[batch.length - 1] as unknown as { nome: string; id: number };
    lastNome = last.nome;
    lastId = Number(last.id);
  }
  _pacientes = all.map((r) => fromRow(r));
  _saveCachedSnapshot(tenantId, _pacientes);
  notify();
}

export const getPacientes = (): Paciente[] => _pacientes;
export const getPacienteById = (id: number): Paciente | undefined => _pacientes.find(p => p.id === id);
export const getPacienteByCPF = (cpf: string): Paciente | undefined => {
  const digits = cpf.replace(/\D/g, "");
  return _pacientes.find(p => p.cpf.replace(/\D/g, "") === digits);
};

export async function addPaciente(input: Omit<Paciente, "id" | "initials">): Promise<Paciente> {
  const tempId = -Date.now();
  const optimistic: Paciente = { ...input, id: tempId, friendlyId: input.friendlyId || "", initials: initials(input.nome) };
  const prev = _pacientes;
  _pacientes = [optimistic, ..._pacientes];
  notify();

  try {
    const tenant_id = await getCurrentTenantId();
    const insertPayload: PacienteInsert = {
      ...toRow(input),
      tenant_id,
      // Campos NOT NULL exigidos pelo Insert (já garantidos pelo formulário)
      nome: input.nome,
      cpf: input.cpf ? input.cpf.replace(/\D/g, "") : null,
    };
    const data = await persistOneOrThrow<PacienteRow>(
      supabase.from("pacientes").insert(insertPayload),
      "pacientes.criar",
    );
    _pacientes = _pacientes.map(p => p.id === tempId ? fromRow(data) : p);
    notify();
    return _pacientes.find(p => p.id === Number(data.id))!;
  } catch (err) {
    _pacientes = prev;
    notify();
    // 23505 = unique_violation → CPF já cadastrado neste tenant
    const cause = (err instanceof PersistError ? err.cause : err) as { code?: string } | null;
    if (cause?.code === "23505") {
      throw new Error("CPF já cadastrado para este laboratório.");
    }
    throw err;
  }
}

export async function updatePaciente(id: number, patch: Partial<Paciente>): Promise<void> {
  const prev = _pacientes;
  _pacientes = _pacientes.map(p => p.id === id ? { ...p, ...patch, initials: patch.nome ? initials(patch.nome) : p.initials } : p);
  notify();

  try {
    const data = await persistOneOrThrow<PacienteRow>(
      supabase.from("pacientes").update(toRow(patch)).eq("id", id),
      "pacientes.atualizar",
    );
    _pacientes = _pacientes.map(p => p.id === id ? fromRow(data) : p);
    notify();
  } catch (err) {
    _pacientes = prev;
    notify();
    const cause = (err instanceof PersistError ? err.cause : err) as { code?: string } | null;
    if (cause?.code === "23505") {
      throw new Error("CPF já cadastrado para este laboratório.");
    }
    throw err;
  }
}

export async function togglePacienteStatus(id: number): Promise<void> {
  const p = _pacientes.find(x => x.id === id);
  if (!p) return;
  await updatePaciente(id, { status: p.status === "Ativo" ? "Inativo" : "Ativo" });
}

export async function removePaciente(id: number): Promise<void> {
  const prev = _pacientes;
  _pacientes = _pacientes.filter(p => p.id !== id);
  notify();
  try {
    await persistOneOrThrow<PacienteRow>(
      supabase.from("pacientes").delete().eq("id", id),
      "pacientes.remover",
    );
  } catch (err) {
    _pacientes = prev;
    notify();
    throw err;
  }
}

export function subscribePacientes(listener: () => void): () => void {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter(l => l !== listener); };
}
