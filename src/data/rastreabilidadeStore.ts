// Store unificada de rastreabilidade RDC 978/2025.
// Inclui: comunicação de críticos, entregas de resultado, confirmações de identidade,
// orientações pré-analíticas entregues, transporte de amostras e POPs versionados.
//
// Mantém leituras simples sem cache reativo — telas leem sob demanda por atendimento.

import { db as supabase } from "@/runtime/db";
import { getCurrentTenantId } from "@/runtime/db";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

// ============================================================
// 1. COMUNICAÇÃO DE VALORES CRÍTICOS
// ============================================================
export type CriticoCanal = "telefone" | "email" | "whatsapp" | "presencial" | "outro";

export interface CriticoComunicacao {
  id: number;
  atendimentoId: number;
  atendimentoExameId: number;
  protocolo: string;
  pacienteNome: string;
  exameNome: string;
  parametro: string;
  valor: string;
  faixaCritica: string;
  canal: CriticoCanal;
  destinatarioNome: string;
  destinatarioContato: string;
  observacao: string;
  comunicadoPorEmail: string;
  comunicadoEm: string;
}

export async function listarCriticosPorAtendimento(atendimentoId: number): Promise<CriticoComunicacao[]> {
  const { data, error } = await supabase
    .from("criticos_comunicacoes")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("comunicado_em", { ascending: false });
  if (error) { showError(error, { scope: "rastreabilidade.criticos", silent: true }); return []; }
  
  // ✅ Tipo seguro - Supabase retorna este tipo
  type CriticoRow = {
    id: number;
    atendimento_id: number;
    atendimento_exame_id: number;
    protocolo: string;
    paciente_nome: string;
    exame_nome: string;
    parametro: string;
    valor: string;
    faixa_critica: string;
    canal: string;
    destinatario_nome: string;
    destinatario_contato: string;
    observacao: string;
    comunicado_por_email: string;
    comunicado_em: string;
  };
  
  return (data as CriticoRow[] ?? []).map((r) => ({
    id: r.id,
    atendimentoId: r.atendimento_id,
    atendimentoExameId: r.atendimento_exame_id,
    protocolo: r.protocolo,
    pacienteNome: r.paciente_nome,
    exameNome: r.exame_nome,
    parametro: r.parametro,
    valor: r.valor,
    faixaCritica: r.faixa_critica,
    canal: r.canal as CriticoCanal,
    destinatarioNome: r.destinatario_nome,
    destinatarioContato: r.destinatario_contato,
    observacao: r.observacao,
    comunicadoPorEmail: r.comunicado_por_email,
    comunicadoEm: r.comunicado_em,
  }));
}

export async function registrarCriticoComunicacao(input: Omit<CriticoComunicacao, "id" | "comunicadoEm" | "comunicadoPorEmail">): Promise<void> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  const email = auth?.user?.email ?? "";
  await persistOneOrThrow(
    supabase.from("criticos_comunicacoes").insert({
      tenant_id: tenant,
      atendimento_id: input.atendimentoId,
      atendimento_exame_id: input.atendimentoExameId,
      protocolo: input.protocolo,
      paciente_nome: input.pacienteNome,
      exame_nome: input.exameNome,
      parametro: input.parametro,
      valor: input.valor,
      faixa_critica: input.faixaCritica,
      canal: input.canal,
      destinatario_nome: input.destinatarioNome,
      destinatario_contato: input.destinatarioContato,
      observacao: input.observacao,
      comunicado_por_email: email,
      comunicado_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.registrarCritico",
  );
}

// ============================================================
// 2. ENTREGA DE RESULTADO
// ============================================================
export type EntregaCanal = "presencial" | "email" | "whatsapp" | "portal" | "impresso" | "outro";

export interface ResultadoEntrega {
  id: number;
  atendimentoId: number;
  atendimentoExameId: number | null;
  protocolo: string;
  pacienteNome: string;
  canal: EntregaCanal;
  destinatarioNome: string;
  destinatarioContato: string;
  observacao: string;
  entreguePorEmail: string;
  entregueEm: string;
}

export async function listarEntregasPorAtendimento(atendimentoId: number): Promise<ResultadoEntrega[]> {
  const { data, error } = await supabase
    .from("resultados_entregas")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("entregue_em", { ascending: false });
  if (error) { showError(error, { scope: "rastreabilidade.entregas", silent: true }); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    atendimentoId: r.atendimento_id,
    atendimentoExameId: r.atendimento_exame_id,
    protocolo: r.protocolo,
    pacienteNome: r.paciente_nome,
    canal: r.canal,
    destinatarioNome: r.destinatario_nome,
    destinatarioContato: r.destinatario_contato,
    observacao: r.observacao,
    entreguePorEmail: r.entregue_por_email,
    entregueEm: r.entregue_em,
  }));
}

export async function registrarEntrega(input: Omit<ResultadoEntrega, "id" | "entregueEm" | "entreguePorEmail">): Promise<void> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  await persistOneOrThrow(
    supabase.from("resultados_entregas").insert({
      tenant_id: tenant,
      atendimento_id: input.atendimentoId,
      atendimento_exame_id: input.atendimentoExameId,
      protocolo: input.protocolo,
      paciente_nome: input.pacienteNome,
      canal: input.canal,
      destinatario_nome: input.destinatarioNome,
      destinatario_contato: input.destinatarioContato,
      observacao: input.observacao,
      entregue_por_email: auth?.user?.email ?? "",
      entregue_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.registrarEntrega",
  );
}

// ============================================================
// 3. CONFIRMAÇÃO DE IDENTIDADE
// ============================================================
export interface IdentidadeConfirmacao {
  id: number;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  identificadores: string[];
  observacao: string;
  confirmadoPorEmail: string;
  confirmadoEm: string;
}

export async function listarConfirmacoesPorAtendimento(atendimentoId: number): Promise<IdentidadeConfirmacao[]> {
  const { data, error } = await supabase
    .from("identidade_confirmacoes")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("confirmado_em", { ascending: false });
  if (error) { showError(error, { scope: "rastreabilidade.identidade", silent: true }); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    atendimentoId: r.atendimento_id,
    protocolo: r.protocolo,
    pacienteNome: r.paciente_nome,
    identificadores: Array.isArray(r.identificadores) ? r.identificadores : [],
    observacao: r.observacao,
    confirmadoPorEmail: r.confirmado_por_email,
    confirmadoEm: r.confirmado_em,
  }));
}

export async function confirmarIdentidade(input: {
  atendimentoId: number; protocolo: string; pacienteNome: string;
  identificadores: string[]; observacao?: string;
}): Promise<void> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  await persistOneOrThrow(
    supabase.from("identidade_confirmacoes").insert({
      tenant_id: tenant,
      atendimento_id: input.atendimentoId,
      protocolo: input.protocolo,
      paciente_nome: input.pacienteNome,
      identificadores: input.identificadores,
      observacao: input.observacao ?? "",
      confirmado_por_email: auth?.user?.email ?? "",
      confirmado_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.confirmarIdentidade",
  );
}

// ============================================================
// 4. ORIENTAÇÕES PRÉ-ANALÍTICAS
// ============================================================
export interface OrientacaoEntregue {
  id: number;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  exames: string[];
  itensOrientados: string[];
  canal: string;
  observacao: string;
  entreguePorEmail: string;
  entregueEm: string;
}

export async function listarOrientacoesPorAtendimento(atendimentoId: number): Promise<OrientacaoEntregue[]> {
  const { data, error } = await supabase
    .from("orientacoes_entregues")
    .select("*")
    .eq("atendimento_id", atendimentoId)
    .order("entregue_em", { ascending: false });
  if (error) { showError(error, { scope: "rastreabilidade.orientacoes", silent: true }); return []; }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    atendimentoId: r.atendimento_id,
    protocolo: r.protocolo,
    pacienteNome: r.paciente_nome,
    exames: Array.isArray(r.exames) ? r.exames : [],
    itensOrientados: Array.isArray(r.itens_orientados) ? r.itens_orientados : [],
    canal: r.canal,
    observacao: r.observacao,
    entreguePorEmail: r.entregue_por_email,
    entregueEm: r.entregue_em,
  }));
}

export async function registrarOrientacoes(input: {
  atendimentoId: number; protocolo: string; pacienteNome: string;
  exames: string[]; itensOrientados: string[]; canal?: string; observacao?: string;
}): Promise<void> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  await persistOneOrThrow(
    supabase.from("orientacoes_entregues").insert({
      tenant_id: tenant,
      atendimento_id: input.atendimentoId,
      protocolo: input.protocolo,
      paciente_nome: input.pacienteNome,
      exames: input.exames,
      itens_orientados: input.itensOrientados,
      canal: input.canal ?? "presencial",
      observacao: input.observacao ?? "",
      entregue_por_email: auth?.user?.email ?? "",
      entregue_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.registrarOrientacoes",
  );
}

// ============================================================
// 5. TRANSPORTE / CADEIA DE CUSTÓDIA
// ============================================================
export type TransporteStatus = "em_transito" | "recebido" | "divergente" | "cancelado";

export interface TransporteRemessa {
  id: number;
  codigo: string;
  origemTipo: "unidade" | "externo";
  origemNome: string;
  destinoTipo: "unidade" | "lab_apoio" | "externo";
  destinoNome: string;
  amostras: { codigo: string; paciente: string; exame: string }[];
  qtdAmostras: number;
  temperatura: string;
  condicoes: string;
  observacao: string;
  responsavelEnvio: string;
  enviadoPorEmail: string;
  enviadoEm: string;
  responsavelRecebimento: string;
  recebidoPorEmail: string;
  recebidoEm: string | null;
  status: TransporteStatus;
  observacaoRecebimento: string;
}

function mapRemessa(r: any): TransporteRemessa {
  return {
    id: r.id,
    codigo: r.codigo,
    origemTipo: r.origem_tipo,
    origemNome: r.origem_nome,
    destinoTipo: r.destino_tipo,
    destinoNome: r.destino_nome,
    amostras: Array.isArray(r.amostras) ? r.amostras : [],
    qtdAmostras: r.qtd_amostras,
    temperatura: r.temperatura,
    condicoes: r.condicoes,
    observacao: r.observacao,
    responsavelEnvio: r.responsavel_envio,
    enviadoPorEmail: r.enviado_por_email,
    enviadoEm: r.enviado_em,
    responsavelRecebimento: r.responsavel_recebimento,
    recebidoPorEmail: r.recebido_por_email,
    recebidoEm: r.recebido_em,
    status: r.status,
    observacaoRecebimento: r.observacao_recebimento,
  };
}

export async function listarRemessas(): Promise<TransporteRemessa[]> {
  const { data, error } = await supabase
    .from("transporte_remessas")
    .select("*")
    .order("enviado_em", { ascending: false })
    .limit(200);
  if (error) { showError(error, { scope: "rastreabilidade.transporte", silent: true }); return []; }
  return (data ?? []).map(mapRemessa);
}

export async function criarRemessa(input: Omit<TransporteRemessa, "id" | "codigo" | "enviadoEm" | "enviadoPorEmail" | "recebidoEm" | "recebidoPorEmail" | "status" | "observacaoRecebimento" | "responsavelRecebimento">): Promise<TransporteRemessa> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  const codigo = `REM-${Date.now().toString().slice(-8)}`;
  const data = await persistOneOrThrow(
    supabase.from("transporte_remessas").insert({
      tenant_id: tenant,
      codigo,
      origem_tipo: input.origemTipo,
      origem_nome: input.origemNome,
      destino_tipo: input.destinoTipo,
      destino_nome: input.destinoNome,
      amostras: input.amostras,
      qtd_amostras: input.qtdAmostras,
      temperatura: input.temperatura,
      condicoes: input.condicoes,
      observacao: input.observacao,
      responsavel_envio: input.responsavelEnvio,
      enviado_por_email: auth?.user?.email ?? "",
      enviado_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.criarRemessa",
  );
  return mapRemessa(data);
}

export async function confirmarRecebimento(id: number, input: { responsavel: string; observacao?: string; status?: TransporteStatus }): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  await persistOneOrThrow(
    supabase.from("transporte_remessas").update({
      status: input.status ?? "recebido",
      responsavel_recebimento: input.responsavel,
      recebido_por_email: auth?.user?.email ?? "",
      recebido_por: auth?.user?.id ?? null,
      recebido_em: new Date().toISOString(),
      observacao_recebimento: input.observacao ?? "",
    }).eq("id", id),
    "rastreabilidade.confirmarRecebimento",
  );
}

// ============================================================
// 6. POPs (Procedimentos Operacionais Padrão)
// ============================================================
export interface ExamePop {
  id: number;
  exameId: string;
  versao: string;
  metodologia: string;
  conteudo: string;
  vigenteDe: string;
  vigenteAte: string | null;
  ativo: boolean;
  publicadoPorEmail: string;
  createdAt: string;
}

function mapPop(r: any): ExamePop {
  return {
    id: r.id,
    exameId: r.exame_id,
    versao: r.versao,
    metodologia: r.metodologia,
    conteudo: r.conteudo,
    vigenteDe: r.vigente_de,
    vigenteAte: r.vigente_ate,
    ativo: r.ativo,
    publicadoPorEmail: r.publicado_por_email,
    createdAt: r.created_at,
  };
}

export async function listarPopsPorExame(exameId: string): Promise<ExamePop[]> {
  const { data, error } = await supabase
    .from("exame_pops")
    .select(
      "id, exame_id, versao, metodologia, conteudo, vigente_de, vigente_ate, ativo, publicado_por_email, created_at"
    )
    .eq("exame_id", exameId)
    .order("vigente_de", { ascending: false });
  if (error) { showError(error, { scope: "rastreabilidade.pops", silent: true }); return []; }
  return (data ?? []).map(mapPop);
}

export async function publicarPop(input: {
  exameId: string; versao: string; metodologia: string; conteudo: string; vigenteDe: string;
}): Promise<ExamePop> {
  const tenant = await getCurrentTenantId();
  if (!tenant) throw new Error("Tenant não encontrado");
  const { data: auth } = await supabase.auth.getUser();
  // Encerra POP ativo anterior (pode não existir — expectAtLeast=0)
  await persistOrThrow(
    supabase.from("exame_pops")
      .update({ ativo: false, vigente_ate: input.vigenteDe })
      .eq("exame_id", input.exameId)
      .eq("ativo", true),
    "rastreabilidade.publicarPop.encerrar",
    { expectAtLeast: 0 },
  );
  const data = await persistOneOrThrow(
    supabase.from("exame_pops").insert({
      tenant_id: tenant,
      exame_id: input.exameId,
      versao: input.versao,
      metodologia: input.metodologia,
      conteudo: input.conteudo,
      vigente_de: input.vigenteDe,
      ativo: true,
      publicado_por_email: auth?.user?.email ?? "",
      publicado_por: auth?.user?.id ?? null,
    }),
    "rastreabilidade.publicarPop.inserir",
  );
  return mapPop(data);
}

export async function inativarPop(id: number): Promise<void> {
  await persistOneOrThrow(
    supabase.from("exame_pops")
      .update({ ativo: false, vigente_ate: new Date().toISOString().slice(0, 10) })
      .eq("id", id),
    "rastreabilidade.inativarPop",
  );
}