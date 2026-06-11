/**
 * Soroteca Store — camada ADITIVA para gerenciamento de amostras.
 *
 * Princípios:
 *  - NÃO altera nada no fluxo existente de atendimento_exames.
 *  - Toda integração é opcional: o sistema funciona normalmente sem soroteca.
 *  - Compatível com múltiplas amostras (amostra_seq) já existente.
 */

import { supabase } from "@/integrations/supabase/client";
import { resolveAmostrasPorLab, type RoteavelExame } from "@/lib/labApoio";
import { persistOrThrow, persistOneOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export type AmostraStatus = "DISPONIVEL" | "UTILIZADA" | "VENCIDA" | "DESCARTADA";

export interface Amostra {
  id: string;
  tenant_id: string;
  atendimento_id: number | null;
  atendimento_exame_id: number | null;
  exame_id: string | null;
  paciente_id: number | null;
  codigo_barra: string;
  tipo_material: string;
  status: AmostraStatus;
  data_coleta: string;
  data_validade: string;
  localizacao: string;
  observacao: string;
  created_at: string;
  updated_at: string;
}

/** Validade padrão em horas (fallback quando exame não define). */
const VALIDADE_PADRAO_HORAS = 24;

/** Materiais que NÃO podem ser reutilizados (sempre exigem material fresco). */
const MATERIAIS_NAO_REUTILIZAVEIS = new Set<string>([
  "URINA",
  "FEZES",
  "ESCARRO",
  "SECRECAO",
]);

function calcValidade(horas: number = VALIDADE_PADRAO_HORAS, base: Date = new Date()): string {
  const d = new Date(base.getTime() + horas * 60 * 60 * 1000);
  return d.toISOString();
}

/**
 * Calcula dígito verificador (mesma regra da função SQL `_calc_dv_amostra`).
 * Pesos alternados 3,1,3,1,... — soma mod 10, complemento para 10.
 */
function calcDV(digitos: string): string {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    const d = parseInt(digitos[i], 10);
    if (Number.isNaN(d)) continue;
    const peso = i % 2 === 0 ? 3 : 1;
    soma += d * peso;
  }
  return String((10 - (soma % 10)) % 10);
}

/**
 * Valida o dígito verificador de um código `A-YYYYMMDD-NNNNNN-D`.
 * Aceita também o formato legado sem DV.
 */
export function validarCodigoAmostra(codigo: string): boolean {
  const novo = /^A-(\d{8})-(\d{6})-(\d)$/.exec(codigo);
  if (novo) {
    const [, ymd, seq, dv] = novo;
    return calcDV(ymd + seq) === dv;
  }
  // Legado: A-YYYYMMDD-RANDOM6 — sempre considerado válido
  return /^A-\d{8}-\d{6}$/.test(codigo);
}

/**
 * Gera código de amostra usando a função SQL (sequencial por dia + DV).
 * Em caso de falha (ex: rede), faz fallback local não-sequencial mantendo o formato.
 */
async function gerarCodigoBarra(tenantId: string): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("gerar_codigo_amostra", {
      _tenant_id: tenantId,
    });
    if (!error && typeof data === "string" && data.length > 0) return data;
  } catch {
    // ignora — usa fallback abaixo
  }
  // Fallback local (mantém formato com DV calculado client-side)
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  const dv = calcDV(ymd + rand);
  return `A-${ymd}-${rand}-${dv}`;
}

/**
 * Cria uma amostra para um exame coletado.
 * Falhas são tolerantes — apenas logam, não quebram o fluxo de coleta.
 */
export async function criarAmostraParaExame(params: {
  atendimentoExameId: number;
  atendimentoId?: number | null;
  exameId?: string | null;
  pacienteId?: number | null;
  tipoMaterial?: string;
  localizacao?: string;
  validadeHoras?: number;
}): Promise<{ ok: boolean; amostra?: Amostra; error?: string }> {
  try {
    // tenant_id é resolvido pelo RLS via current_tenant_id() — buscamos via session
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { ok: false, error: "not-authenticated" };

    // Resolve tenant_id do profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!profile?.tenant_id) return { ok: false, error: "no-tenant" };

    const insert = {
      tenant_id: profile.tenant_id,
      atendimento_id: params.atendimentoId ?? null,
      atendimento_exame_id: params.atendimentoExameId,
      exame_id: params.exameId ?? null,
      paciente_id: params.pacienteId ?? null,
      codigo_barra: await gerarCodigoBarra(profile.tenant_id),
      tipo_material: (params.tipoMaterial ?? "").toUpperCase(),
      status: "DISPONIVEL" as AmostraStatus,
      data_coleta: new Date().toISOString(),
      data_validade: calcValidade(params.validadeHoras),
      localizacao: params.localizacao ?? "",
      observacao: "",
    };

    let data: Amostra;
    try {
      data = await persistOneOrThrow<Amostra>(
        supabase.from("amostras").insert(insert),
        "soroteca.criarAmostraParaExame.insert",
      );
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }

    // Vincula a amostra ao exame — se falhar, ROLLBACK da amostra para evitar órfão
    try {
      await persistOneOrThrow(
        supabase
          .from("atendimento_exames")
          .update({ amostra_id: data.id })
          .eq("id", params.atendimentoExameId),
        "soroteca.criarAmostraParaExame.vincular",
      );
    } catch (e) {
      // rollback explícito da amostra recém-criada
      await supabase.from("amostras").delete().eq("id", data.id);
      return { ok: false, error: `vínculo falhou: ${(e as Error).message}` };
    }

    return { ok: true, amostra: data };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Cria amostras respeitando a regra "1 amostra = 1 lab".
 *
 * Aceita uma lista de exames (que podem ou não compartilhar tubo) e:
 *  1. agrupa por (grupo_exame_id + lab_apoio_id);
 *  2. cria UMA amostra por grupo;
 *  3. vincula todos os exames do grupo à mesma amostra_id.
 *
 * Não substitui `criarAmostraParaExame` — é uma função adicional para fluxos
 * que precisam routar múltiplos exames de uma vez (coleta em lote, criação de
 * atendimento com vários exames terceirizados etc.).
 */
export interface ExameParaAmostragem extends RoteavelExame {
  atendimentoExameId: number;
  atendimentoId?: number | null;
  exameId?: string | null;
  pacienteId?: number | null;
  tipoMaterial?: string;
}

export async function criarAmostrasParaExames(
  exames: ExameParaAmostragem[],
  opts?: { localizacao?: string; validadeHoras?: number },
): Promise<{ ok: boolean; amostrasPorExame: Record<number, string>; erros: string[] }> {
  const amostrasPorExame: Record<number, string> = {};
  const erros: string[] = [];
  if (exames.length === 0) return { ok: true, amostrasPorExame, erros };

  // Resolve tenant uma vez
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { ok: false, amostrasPorExame, erros: ["not-authenticated"] };
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!profile?.tenant_id) return { ok: false, amostrasPorExame, erros: ["no-tenant"] };
  const tenantId = profile.tenant_id as string;

  // Aplica regra "1 amostra = 1 lab" — pode dividir o que viria como um único tubo
  const grupos = resolveAmostrasPorLab(exames);

  for (const grupo of grupos) {
    try {
      const codigo = await gerarCodigoBarra(tenantId);
      // Material e contexto comuns ao grupo (vem do primeiro exame não-vazio)
      const ref = grupo.exames.find((e) => e.tipoMaterial) ?? grupo.exames[0];
      const insert = {
        tenant_id: tenantId,
        atendimento_id: ref.atendimentoId ?? null,
        atendimento_exame_id: ref.atendimentoExameId,
        exame_id: ref.exameId ?? null,
        paciente_id: ref.pacienteId ?? null,
        codigo_barra: codigo,
        tipo_material: (ref.tipoMaterial ?? "").toUpperCase(),
        status: "DISPONIVEL" as AmostraStatus,
        data_coleta: new Date().toISOString(),
        data_validade: calcValidade(opts?.validadeHoras),
        localizacao: opts?.localizacao ?? "",
        observacao: grupo.tipoProcesso === "TERCEIRIZADO"
          ? `Destino: lab apoio ${grupo.labApoioId ?? "(n/d)"}`
          : "",
      };
      let amostraId: string;
      try {
        const row = await persistOneOrThrow<{ id: string }>(
          supabase.from("amostras").insert(insert),
          `soroteca.lote.insert[${grupo.chave}]`,
          { selectCols: "id" },
        );
        amostraId = row.id;
      } catch (e) {
        erros.push(`grupo ${grupo.chave}: ${(e as Error).message}`);
        continue;
      }
      // Vincula todos os exames do grupo à mesma amostra — rollback se falhar
      const ids = grupo.exames.map((e) => e.atendimentoExameId);
      try {
        await persistOrThrow(
          supabase
            .from("atendimento_exames")
            .update({ amostra_id: amostraId })
            .in("id", ids),
          `soroteca.lote.vincular[${grupo.chave}]`,
          { expectAtLeast: ids.length },
        );
      } catch (e) {
        await supabase.from("amostras").delete().eq("id", amostraId);
        erros.push(`grupo ${grupo.chave} vínculo: ${(e as Error).message}`);
        continue;
      }
      for (const id of ids) amostrasPorExame[id] = amostraId;
    } catch (e) {
      erros.push(`grupo ${grupo.chave} exception: ${(e as Error).message}`);
    }
  }

  return { ok: erros.length === 0, amostrasPorExame, erros };
}

/**
 * Busca amostras DISPONÍVEIS e ainda dentro da validade, para o mesmo paciente + exame.
 * Retorna lista ordenada da mais recente para a mais antiga.
 */
export async function buscarAmostrasReutilizaveis(params: {
  pacienteId: number;
  exameId?: string | null;
  tipoMaterial?: string;
}): Promise<Amostra[]> {
  if (!params.pacienteId || !params.exameId) return [];
  // Bloqueio por material não-reutilizável
  if (params.tipoMaterial && MATERIAIS_NAO_REUTILIZAVEIS.has(params.tipoMaterial.toUpperCase())) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("amostras")
    .select("*")
    .eq("paciente_id", params.pacienteId)
    .eq("exame_id", params.exameId)
    .eq("status", "DISPONIVEL")
    .gte("data_validade", nowIso)
    .order("data_coleta", { ascending: false });

  if (error) {
    showError(error, { scope: "soroteca.buscarReutilizaveis", silent: true });
    return [];
  }
  return (data ?? []) as Amostra[];
}

/**
 * Marca uma amostra como UTILIZADA e vincula ao novo exame de atendimento.
 * Usado quando o usuário escolhe reutilizar.
 */
export async function reutilizarAmostra(params: {
  amostraId: string;
  atendimentoExameId: number;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOneOrThrow(
      supabase.from("amostras").update({ status: "UTILIZADA" }).eq("id", params.amostraId),
      "soroteca.reutilizar.amostra",
    );
    try {
      await persistOneOrThrow(
        supabase
          .from("atendimento_exames")
          .update({
            amostra_id: params.amostraId,
            is_reutilizacao: true,
            status: "coletado",
            data_coleta: new Date().toISOString(),
          })
          .eq("id", params.atendimentoExameId),
        "soroteca.reutilizar.vincular",
      );
    } catch (e) {
      // Rollback do status da amostra
      await supabase.from("amostras").update({ status: "DISPONIVEL" }).eq("id", params.amostraId);
      return { ok: false, error: (e as Error).message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Lista todas amostras (para tela de gestão futura). */
export async function listarAmostras(filtros?: {
  status?: AmostraStatus;
  search?: string;
}): Promise<Amostra[]> {
  let query = supabase.from("amostras").select("*").order("data_coleta", { ascending: false });
  if (filtros?.status) query = query.eq("status", filtros.status);
  if (filtros?.search) {
    query = query.ilike("codigo_barra", `%${filtros.search}%`);
  }
  const { data, error } = await query;
  if (error) {
    showError(error, { scope: "soroteca.listar", silent: true });
    return [];
  }
  return (data ?? []) as Amostra[];
}

/** Atualiza localização ou descarta. */
export async function atualizarAmostra(
  id: string,
  patch: Partial<Pick<Amostra, "status" | "localizacao" | "observacao">>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await persistOrThrow(
      supabase.from("amostras").update(patch).eq("id", id),
      "soroteca.atualizar",
    );
    return { ok: true };
  } catch (e) {
    showError(e, { scope: "soroteca.atualizar", silent: true });
    return { ok: false, error: (e as Error).message };
  }
}

/** Roda manualmente o job de marcar vencidas (também roda via cron no backend). */
export async function marcarVencidas(): Promise<number> {
  const { data, error } = await supabase.rpc("marcar_amostras_vencidas" as never);
  if (error) {
    showError(error, { scope: "soroteca.marcarVencidas", silent: true });
    return 0;
  }
  return (data as number) ?? 0;
}

/** Status visual: verde / amarelo / vermelho conforme validade. */
export function statusVisual(amostra: Amostra): "ok" | "warning" | "danger" {
  if (amostra.status !== "DISPONIVEL") return "danger";
  const restanteHoras = (new Date(amostra.data_validade).getTime() - Date.now()) / 3_600_000;
  if (restanteHoras < 0) return "danger";
  if (restanteHoras < 4) return "warning";
  return "ok";
}

/**
 * Variante de busca por NOME de exame — útil em fluxos onde só conhecemos o nome
 * (ex.: NovoAtendimento). Resolve internamente o exame_id no catálogo do tenant.
 */
export async function buscarAmostrasReutilizaveisPorNome(params: {
  pacienteId: number;
  nomeExame: string;
}): Promise<Amostra[]> {
  if (!params.pacienteId || !params.nomeExame) return [];
  const { data: catalogo } = await supabase
    .from("exames_catalogo")
    .select("id, material")
    .ilike("nome", params.nomeExame)
    .limit(1)
    .maybeSingle();
  if (!catalogo?.id) return [];
  return buscarAmostrasReutilizaveis({
    pacienteId: params.pacienteId,
    exameId: catalogo.id,
    tipoMaterial: catalogo.material ?? "",
  });
}

/**
 * Detalhes completos da amostra para o modal de inspeção.
 * Agrega: paciente, atendimento, exames vinculados (incluindo reutilizações)
 * e linha do tempo de auditoria/eventos.
 */
export interface AmostraExameVinculado {
  id: number;
  nome_exame: string;
  status: string;
  data_coleta: string | null;
  data_analise: string | null;
  data_liberacao: string | null;
  is_reutilizacao: boolean;
  analista: string;
  coletor: string;
  atendimento_id: number;
  protocolo: string;
  paciente_nome: string;
  tipo_processo: string;
  lab_apoio_id: string | null;
  data_envio: string | null;
  data_retorno: string | null;
}

export interface AmostraEvento {
  id: string;
  tipo: "CRIACAO" | "STATUS" | "REUTILIZACAO" | "ANALISE" | "LIBERACAO" | "DESCARTE" | "AUDITORIA";
  titulo: string;
  descricao?: string;
  data: string;
  autor?: string;
}

export interface AmostraDetalhe {
  amostra: Amostra;
  paciente: {
    id: number | null;
    nome: string;
    cpf: string;
    nascimento: string | null;
    sexo: string;
  } | null;
  atendimento: {
    id: number;
    protocolo: string;
    data: string;
    status_atendimento: string;
    convenio_nome: string;
    solicitante: string;
    paciente_nome: string;
    paciente_cpf: string;
    paciente_nascimento: string | null;
  } | null;
  exames: AmostraExameVinculado[];
  eventos: AmostraEvento[];
  /** Resumo do agrupamento por material (mesmo tubo). */
  agrupamento: {
    totalExames: number;
    examesOriginais: number;
    examesReuso: number;
  };
  /** Sinaliza se há vínculo com fluxo de exame terceirizado (lab apoio). */
  terceirizado: {
    isTerceirizado: boolean;
    statusEnvio: "AGUARDANDO_ENVIO" | "ENVIADO" | "RETORNADO" | "NAO_APLICAVEL";
    labApoioNome: string | null;
    dataEnvio: string | null;
    dataRetorno: string | null;
  };
}

export async function getAmostraDetalhe(id: string): Promise<AmostraDetalhe | null> {
  const { data: amostra, error } = await supabase
    .from("amostras")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !amostra) {
    showError(error ?? new Error("amostra não encontrada"), { scope: "soroteca.getDetalhe", silent: true });
    return null;
  }

  // Paciente
  let paciente: AmostraDetalhe["paciente"] = null;
  if (amostra.paciente_id) {
    const { data: p } = await supabase
      .from("pacientes")
      .select("id, nome, cpf, data_nascimento, sexo")
      .eq("id", amostra.paciente_id)
      .maybeSingle();
    if (p) {
      paciente = {
        id: p.id,
        nome: p.nome,
        cpf: p.cpf,
        nascimento: p.data_nascimento,
        sexo: p.sexo,
      };
    }
  }

  // Atendimento
  let atendimento: AmostraDetalhe["atendimento"] = null;
  if (amostra.atendimento_id) {
    const { data: at } = await supabase
      .from("atendimentos")
      .select("id, protocolo, data, status_atendimento, convenio_nome, solicitante, paciente_nome, paciente_cpf, paciente_nascimento")
      .eq("id", amostra.atendimento_id)
      .maybeSingle();
    if (at) atendimento = at as AmostraDetalhe["atendimento"];
  }

  // Exames vinculados (originais + reutilizações)
  const { data: examesRaw } = await supabase
    .from("atendimento_exames")
    .select(
      "id, nome_exame, status, data_coleta, data_analise, data_liberacao, is_reutilizacao, analista, coletor, atendimento_id, tipo_processo, lab_apoio_id, data_envio, data_retorno",
    )
    .eq("amostra_id", id)
    .order("data_coleta", { ascending: true });

  const exames: AmostraExameVinculado[] = [];
  if (examesRaw && examesRaw.length > 0) {
    const atendimentoIds = Array.from(new Set(examesRaw.map((e) => e.atendimento_id)));
    const { data: ats } = await supabase
      .from("atendimentos")
      .select("id, protocolo, paciente_nome")
      .in("id", atendimentoIds);
    const atMap = new Map((ats ?? []).map((a) => [a.id, a]));
    for (const e of examesRaw) {
      const at = atMap.get(e.atendimento_id);
      exames.push({
        id: e.id,
        nome_exame: e.nome_exame,
        status: e.status,
        data_coleta: e.data_coleta,
        data_analise: e.data_analise,
        data_liberacao: e.data_liberacao,
        is_reutilizacao: e.is_reutilizacao,
        analista: e.analista ?? "",
        coletor: e.coletor ?? "",
        atendimento_id: e.atendimento_id,
        protocolo: at?.protocolo ?? `#${e.atendimento_id}`,
        paciente_nome: at?.paciente_nome ?? "",
        tipo_processo: (e as { tipo_processo?: string }).tipo_processo ?? "INTERNO",
        lab_apoio_id: (e as { lab_apoio_id?: string | null }).lab_apoio_id ?? null,
        data_envio: (e as { data_envio?: string | null }).data_envio ?? null,
        data_retorno: (e as { data_retorno?: string | null }).data_retorno ?? null,
      });
    }
  }

  // Detecta terceirizado e busca nome do lab apoio
  const exameTerceirizado = exames.find((e) => e.tipo_processo === "TERCEIRIZADO");
  let labApoioNome: string | null = null;
  if (exameTerceirizado?.lab_apoio_id) {
    const { data: lab } = await supabase
      .from("labs_apoio")
      .select("nome")
      .eq("id", exameTerceirizado.lab_apoio_id)
      .maybeSingle();
    labApoioNome = lab?.nome ?? null;
  }

  let statusEnvio: "AGUARDANDO_ENVIO" | "ENVIADO" | "RETORNADO" | "NAO_APLICAVEL" = "NAO_APLICAVEL";
  if (exameTerceirizado) {
    if (exameTerceirizado.data_retorno) statusEnvio = "RETORNADO";
    else if (exameTerceirizado.data_envio) statusEnvio = "ENVIADO";
    else statusEnvio = "AGUARDANDO_ENVIO";
  }

  // Auditoria — eventos relacionados ao atendimento da amostra
  const eventos: AmostraEvento[] = [];

  // 1. Criação
  eventos.push({
    id: `criacao-${amostra.id}`,
    tipo: "CRIACAO",
    titulo: "Amostra criada",
    descricao: `Código ${amostra.codigo_barra} • Material: ${amostra.tipo_material || "—"}`,
    data: amostra.created_at,
  });

  // 2. Eventos derivados dos exames
  for (const e of exames) {
    if (e.is_reutilizacao) {
      eventos.push({
        id: `reuso-${e.id}`,
        tipo: "REUTILIZACAO",
        titulo: "Reutilizada em novo exame",
        descricao: `${e.nome_exame} • Atendimento ${e.protocolo}`,
        data: e.data_coleta ?? amostra.updated_at,
      });
    }
    if (e.data_analise) {
      eventos.push({
        id: `analise-${e.id}`,
        tipo: "ANALISE",
        titulo: "Exame analisado",
        descricao: `${e.nome_exame}${e.analista ? ` • ${e.analista}` : ""}`,
        data: e.data_analise,
      });
    }
    if (e.data_liberacao) {
      eventos.push({
        id: `lib-${e.id}`,
        tipo: "LIBERACAO",
        titulo: "Resultado liberado",
        descricao: e.nome_exame,
        data: e.data_liberacao,
      });
    }
  }

  // 3. Status atual (se diferente de DISPONIVEL e não criação)
  if (amostra.status === "DESCARTADA") {
    eventos.push({
      id: `descarte-${amostra.id}`,
      tipo: "DESCARTE",
      titulo: "Amostra descartada",
      descricao: amostra.observacao || "Marcada como descartada.",
      data: amostra.updated_at,
    });
  } else if (amostra.status === "VENCIDA") {
    eventos.push({
      id: `vencida-${amostra.id}`,
      tipo: "STATUS",
      titulo: "Amostra vencida",
      descricao: "Validade expirada — não pode mais ser reutilizada.",
      data: amostra.data_validade,
    });
  }

  // Ordena cronologicamente
  eventos.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  return {
    amostra: amostra as Amostra,
    paciente,
    atendimento,
    exames,
    eventos,
    agrupamento: {
      totalExames: exames.length,
      examesOriginais: exames.filter((e) => !e.is_reutilizacao).length,
      examesReuso: exames.filter((e) => e.is_reutilizacao).length,
    },
    terceirizado: {
      isTerceirizado: !!exameTerceirizado,
      statusEnvio,
      labApoioNome,
      dataEnvio: exameTerceirizado?.data_envio ?? null,
      dataRetorno: exameTerceirizado?.data_retorno ?? null,
    },
  };
}
