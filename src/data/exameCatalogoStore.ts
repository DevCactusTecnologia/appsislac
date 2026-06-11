// Store centralizado do catálogo de exames — backed by Supabase com cache síncrono.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "./_tenant";
import { persistOneOrThrow, persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";

export interface ExameCatalogo {
  id: string;
  mnemonico: string;
  nome: string;
  categoria: string;
  analise: string;
  codigo: string;
  codigoCBHPM: string;
  codigoTUSS: string;
  material: string;
  ativo: boolean;
  usadoEmAtendimento: boolean;
  // Terceirizados
  tipoProcesso: "INTERNO" | "TERCEIRIZADO";
  labApoioId: string | null;
  integracaoAtiva: boolean;
  // Códigos regulatórios adicionais (LIS)
  porteCBHPM: string;
  codigoLOINC: string;
  codigoSUS: string;
  // Analítico
  metodologia: string;
  prazoEntregaDias: number;
  urgenciaDisponivel: boolean;
  prazoUrgenciaHoras: number;
  // Pré-analítico
  recipiente: string;
  corTampa: string;
  volumeMinimoMl: number;
  estabilidade: string;
  requerJejum: boolean;
  horasJejum: number;
  preparoPaciente: string;
  // Operacional / Etiquetas
  grupoEtiquetas: string;
  quantidadeEtiquetas: number;
  informacoesColeta: string;
  // Operacional avançado
  sinonimos: string;
  sexoAplicavel: "AMBOS" | "MASCULINO" | "FEMININO";
  exibirPortal: boolean;
  // Pós-analítico
  unidadePadrao: string;
  requerAssinaturaMedica: boolean;
  // Vínculo relacional com setor (setores_laboratoriais.id)
  setorId: string | null;
  // Sinalizadores de catálogo regulatório / mapa
  tussSemEquivalente: boolean;
  tipoMapa: string;
  // Pré-analítico avançado
  temperaturaTransporte: string;
  protegidoLuz: boolean;
  observacoesColeta: string;
  // Integração / Apoio
  providerIntegracao: string;
  codigoExameApoio: string;
  permiteEnvioApoio: boolean;
  exigeProtocoloExterno: boolean;
  prazoApoioDias: number;
  materialApoio: string;
  recipienteApoio: string;
  volumeApoioMl: number;
  preparoApoio: string;
  // Resultado / Laudo
  textoInterpretativoPadrao: string;
  exibirMetodologiaLaudo: boolean;
  exibirUnidadeLaudo: boolean;
  exibirMaterialLaudo: boolean;
  templateLaudoId: string | null;
  grupoImpressao: string;
  ordemImpressao: number;
  // Operacional avançado
  idadeMinimaMeses: number | null;
  idadeMaximaMeses: number | null;
  urgenciaPadrao: boolean;
  tags: string[];
  ordemColeta: number;
  ordemSetor: number;
  exameCalculado: boolean;
  exameOculto: boolean;
}

let exames: ExameCatalogo[] = [];
let _listeners: Array<() => void> = [];
function notify() { _listeners.forEach((fn) => fn()); }

// ─── Cache two-tier ────────────────────────────────────────────────────────
// Boot carrega apenas colunas leves (suficientes para listagens, filtros e
// operações cruzadas). Campos pesados ficam com defaults vazios e são
// preenchidos sob demanda via `getExameCatalogoCompleto(id)` antes de abrir
// o modal de edição. Marcamos cada item com `_full` para sabermos se já tem
// a versão completa em memória.
const _fullLoaded = new Set<string>();
const _fullInflight = new Map<string, Promise<ExameCatalogo | null>>();

/** Colunas leves carregadas no boot. Devem cobrir TODAS as leituras feitas
 *  fora dos modais de edição/detalhes (listagens, filtros, vínculos, preços,
 *  vitrine, mapa, atendimento, laudoLayout, tabela de preços).
 */
const SLIM_COLUMNS =
  "id,mnemonico,nome,categoria,analise,codigo,codigo_cbhpm,codigo_tuss," +
  "material,ativo,usado_em_atendimento,tipo_processo,lab_apoio_id," +
  "integracao_ativa,setor_id,exibir_portal,porte_cbhpm,tuss_sem_equivalente,codigo_exame_apoio," +
  "tipo_mapa";

function fromRow(r: any): ExameCatalogo {
  return {
    id: r.id,
    mnemonico: r.mnemonico ?? "",
    nome: r.nome,
    categoria: r.categoria ?? "",
    analise: r.analise ?? "INTERNA",
    codigo: r.codigo ?? "",
    codigoCBHPM: r.codigo_cbhpm ?? "",
    codigoTUSS: r.codigo_tuss ?? "",
    material: r.material ?? "",
    ativo: !!r.ativo,
    usadoEmAtendimento: !!r.usado_em_atendimento,
    tipoProcesso: (r.tipo_processo === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO"),
    labApoioId: r.lab_apoio_id ?? null,
    integracaoAtiva: !!r.integracao_ativa,
    porteCBHPM: r.porte_cbhpm ?? "-",
    codigoLOINC: r.codigo_loinc ?? "",
    codigoSUS: r.codigo_sus ?? "",
    metodologia: r.metodologia ?? "",
    prazoEntregaDias: Number(r.prazo_entrega_dias ?? 1),
    urgenciaDisponivel: !!r.urgencia_disponivel,
    prazoUrgenciaHoras: Number(r.prazo_urgencia_horas ?? 0),
    recipiente: r.recipiente ?? "",
    corTampa: r.cor_tampa ?? "",
    volumeMinimoMl: Number(r.volume_minimo_ml ?? 0),
    estabilidade: r.estabilidade ?? "",
    requerJejum: !!r.requer_jejum,
    horasJejum: Number(r.horas_jejum ?? 0),
    preparoPaciente: r.preparo_paciente ?? "",
    grupoEtiquetas: r.grupo_etiquetas ?? "",
    quantidadeEtiquetas: Number(r.quantidade_etiquetas ?? 1),
    informacoesColeta: r.informacoes_coleta ?? "",
    sinonimos: r.sinonimos ?? "",
    sexoAplicavel: (r.sexo_aplicavel === "MASCULINO" || r.sexo_aplicavel === "FEMININO" ? r.sexo_aplicavel : "AMBOS"),
    exibirPortal: r.exibir_portal !== false,
    unidadePadrao: r.unidade_padrao ?? "",
    requerAssinaturaMedica: r.requer_assinatura_medica !== false,
    setorId: r.setor_id ?? null,
    tussSemEquivalente: !!r.tuss_sem_equivalente,
    tipoMapa: r.tipo_mapa ?? "AUTO",
    temperaturaTransporte: r.temperatura_transporte ?? "",
    protegidoLuz: !!r.protegido_luz,
    observacoesColeta: r.observacoes_coleta ?? "",
    providerIntegracao: r.provider_integracao ?? "",
    codigoExameApoio: r.codigo_exame_apoio ?? "",
    permiteEnvioApoio: !!r.permite_envio_apoio,
    exigeProtocoloExterno: !!r.exige_protocolo_externo,
    prazoApoioDias: Number(r.prazo_apoio_dias ?? 0),
    materialApoio: r.material_apoio ?? "",
    recipienteApoio: r.recipiente_apoio ?? "",
    volumeApoioMl: Number(r.volume_apoio_ml ?? 0),
    preparoApoio: r.preparo_apoio ?? "",
    textoInterpretativoPadrao: r.texto_interpretativo_padrao ?? "",
    exibirMetodologiaLaudo: r.exibir_metodologia_laudo !== false,
    exibirUnidadeLaudo: r.exibir_unidade_laudo !== false,
    exibirMaterialLaudo: !!r.exibir_material_laudo,
    templateLaudoId: r.template_laudo_id ?? null,
    grupoImpressao: r.grupo_impressao ?? "",
    ordemImpressao: Number(r.ordem_impressao ?? 0),
    idadeMinimaMeses: r.idade_minima_meses ?? null,
    idadeMaximaMeses: r.idade_maxima_meses ?? null,
    urgenciaPadrao: !!r.urgencia_padrao,
    tags: Array.isArray(r.tags) ? r.tags : [],
    ordemColeta: Number(r.ordem_coleta ?? 0),
    ordemSetor: Number(r.ordem_setor ?? 0),
    exameCalculado: !!r.exame_calculado,
    exameOculto: !!r.exame_oculto,
  };
}

function toRow(e: Partial<ExameCatalogo>): any {
  const row: Record<string, unknown> = {};
  if (e.mnemonico !== undefined) row.mnemonico = e.mnemonico;
  if (e.nome !== undefined) row.nome = e.nome;
  if (e.categoria !== undefined) row.categoria = e.categoria;
  if (e.analise !== undefined) row.analise = e.analise;
  if (e.codigo !== undefined) row.codigo = e.codigo;
  if (e.codigoCBHPM !== undefined) row.codigo_cbhpm = e.codigoCBHPM;
  if (e.codigoTUSS !== undefined) row.codigo_tuss = e.codigoTUSS;
  if (e.material !== undefined) row.material = e.material;
  if (e.ativo !== undefined) row.ativo = e.ativo;
  if (e.usadoEmAtendimento !== undefined) row.usado_em_atendimento = e.usadoEmAtendimento;
  if (e.tipoProcesso !== undefined) row.tipo_processo = e.tipoProcesso;
  if (e.labApoioId !== undefined) row.lab_apoio_id = e.labApoioId;
  if (e.integracaoAtiva !== undefined) row.integracao_ativa = e.integracaoAtiva;
  if (e.porteCBHPM !== undefined) row.porte_cbhpm = e.porteCBHPM || "-";
  if (e.codigoLOINC !== undefined) row.codigo_loinc = e.codigoLOINC;
  if (e.codigoSUS !== undefined) row.codigo_sus = e.codigoSUS;
  if (e.metodologia !== undefined) row.metodologia = e.metodologia;
  if (e.prazoEntregaDias !== undefined) row.prazo_entrega_dias = e.prazoEntregaDias;
  if (e.urgenciaDisponivel !== undefined) row.urgencia_disponivel = e.urgenciaDisponivel;
  if (e.prazoUrgenciaHoras !== undefined) row.prazo_urgencia_horas = e.prazoUrgenciaHoras;
  if (e.recipiente !== undefined) row.recipiente = e.recipiente;
  if (e.corTampa !== undefined) row.cor_tampa = e.corTampa;
  if (e.volumeMinimoMl !== undefined) row.volume_minimo_ml = e.volumeMinimoMl;
  if (e.estabilidade !== undefined) row.estabilidade = e.estabilidade;
  if (e.requerJejum !== undefined) row.requer_jejum = e.requerJejum;
  if (e.horasJejum !== undefined) row.horas_jejum = e.horasJejum;
  if (e.preparoPaciente !== undefined) row.preparo_paciente = e.preparoPaciente;
  if (e.grupoEtiquetas !== undefined) row.grupo_etiquetas = e.grupoEtiquetas;
  if (e.quantidadeEtiquetas !== undefined) row.quantidade_etiquetas = Math.max(1, Math.min(20, e.quantidadeEtiquetas || 1));
  if (e.informacoesColeta !== undefined) row.informacoes_coleta = e.informacoesColeta;
  if (e.sinonimos !== undefined) row.sinonimos = e.sinonimos;
  if (e.sexoAplicavel !== undefined) row.sexo_aplicavel = e.sexoAplicavel;
  if (e.exibirPortal !== undefined) row.exibir_portal = e.exibirPortal;
  if (e.unidadePadrao !== undefined) row.unidade_padrao = e.unidadePadrao;
  if (e.requerAssinaturaMedica !== undefined) row.requer_assinatura_medica = e.requerAssinaturaMedica;
  if (e.setorId !== undefined) row.setor_id = e.setorId;
  if (e.tussSemEquivalente !== undefined) row.tuss_sem_equivalente = e.tussSemEquivalente;
  if (e.tipoMapa !== undefined) row.tipo_mapa = e.tipoMapa || "AUTO";
  if (e.temperaturaTransporte !== undefined) row.temperatura_transporte = e.temperaturaTransporte;
  if (e.protegidoLuz !== undefined) row.protegido_luz = e.protegidoLuz;
  if (e.observacoesColeta !== undefined) row.observacoes_coleta = e.observacoesColeta;
  if (e.providerIntegracao !== undefined) row.provider_integracao = e.providerIntegracao;
  if (e.codigoExameApoio !== undefined) row.codigo_exame_apoio = e.codigoExameApoio;
  if (e.permiteEnvioApoio !== undefined) row.permite_envio_apoio = e.permiteEnvioApoio;
  if (e.exigeProtocoloExterno !== undefined) row.exige_protocolo_externo = e.exigeProtocoloExterno;
  if (e.prazoApoioDias !== undefined) row.prazo_apoio_dias = Math.max(0, e.prazoApoioDias || 0);
  if (e.materialApoio !== undefined) row.material_apoio = e.materialApoio;
  if (e.recipienteApoio !== undefined) row.recipiente_apoio = e.recipienteApoio;
  if (e.volumeApoioMl !== undefined) row.volume_apoio_ml = e.volumeApoioMl;
  if (e.preparoApoio !== undefined) row.preparo_apoio = e.preparoApoio;
  if (e.textoInterpretativoPadrao !== undefined) row.texto_interpretativo_padrao = e.textoInterpretativoPadrao;
  if (e.exibirMetodologiaLaudo !== undefined) row.exibir_metodologia_laudo = e.exibirMetodologiaLaudo;
  if (e.exibirUnidadeLaudo !== undefined) row.exibir_unidade_laudo = e.exibirUnidadeLaudo;
  if (e.exibirMaterialLaudo !== undefined) row.exibir_material_laudo = e.exibirMaterialLaudo;
  if (e.templateLaudoId !== undefined) row.template_laudo_id = e.templateLaudoId;
  if (e.grupoImpressao !== undefined) row.grupo_impressao = e.grupoImpressao;
  if (e.ordemImpressao !== undefined) row.ordem_impressao = Math.max(0, e.ordemImpressao || 0);
  if (e.idadeMinimaMeses !== undefined) row.idade_minima_meses = e.idadeMinimaMeses;
  if (e.idadeMaximaMeses !== undefined) row.idade_maxima_meses = e.idadeMaximaMeses;
  if (e.urgenciaPadrao !== undefined) row.urgencia_padrao = e.urgenciaPadrao;
  if (e.tags !== undefined) row.tags = Array.isArray(e.tags) ? e.tags : [];
  if (e.ordemColeta !== undefined) row.ordem_coleta = Math.max(0, e.ordemColeta || 0);
  if (e.ordemSetor !== undefined) row.ordem_setor = Math.max(0, e.ordemSetor || 0);
  if (e.exameCalculado !== undefined) row.exame_calculado = e.exameCalculado;
  if (e.exameOculto !== undefined) row.exame_oculto = e.exameOculto;
  return row;
}

export async function _initExamesCatalogoStore(): Promise<void> {
  // Boot leve: select slim. Campos pesados (metodologia, preparo, recipiente,
  // sinônimos etc.) ficam com defaults até o usuário abrir o modal de edição.
  // Pagina em lotes para contornar o limite default do PostgREST (1000 linhas).
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("exames_catalogo")
      .select(SLIM_COLUMNS)
      .order("nome")
      .range(from, from + PAGE - 1);
    if (error) { showError(error, { scope: "exameCatalogoStore.init", silent: true }); return; }
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  exames = all.map(fromRow);
  _fullLoaded.clear();
  _fullInflight.clear();
  notify();
}

export const getExamesCatalogo = (): ExameCatalogo[] => exames;
export const getExamesCatalogoAtivos = (): ExameCatalogo[] => exames.filter(e => e.ativo);
export const getExameCatalogoById = (id: string): ExameCatalogo | undefined => exames.find(e => e.id === id);

/**
 * Busca a versão COMPLETA de um exame (todos os campos), atualizando o cache.
 * Use SEMPRE antes de abrir o modal de edição — nunca passe o objeto slim
 * direto para o formulário (causaria perda silenciosa de campos pesados).
 *
 * Deduplica chamadas concorrentes para o mesmo id e evita refetch quando o
 * objeto já foi promovido a completo.
 */
export async function getExameCatalogoCompleto(id: string): Promise<ExameCatalogo | null> {
  if (_fullLoaded.has(id)) {
    const cur = exames.find((e) => e.id === id);
    if (cur) return cur;
  }
  const inflight = _fullInflight.get(id);
  if (inflight) return inflight;

  const p = (async () => {
    try {
      const { data, error } = await supabase
        .from("exames_catalogo")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) { showError(error, { scope: "exameCatalogoStore.fetchFull", silent: true }); return null; }
      if (!data) return null;
      const full = fromRow(data);
      const idx = exames.findIndex((e) => e.id === id);
      if (idx >= 0) {
        // Substitui em-place mantendo a ordem do array — sem duplicação.
        exames = exames.map((e) => (e.id === id ? full : e));
      } else {
        exames = [...exames, full];
      }
      _fullLoaded.add(id);
      notify();
      return full;
    } finally {
      _fullInflight.delete(id);
    }
  })();
  _fullInflight.set(id, p);
  return p;
}

export async function addExameCatalogo(exame: Omit<ExameCatalogo, "id">): Promise<ExameCatalogo | null> {
  try {
    const tenant_id = await getCurrentTenantId();
    const data = await persistOneOrThrow<any>(
      supabase.from("exames_catalogo").insert({ ...toRow(exame), tenant_id }),
      "exameCatalogo.add",
    );
    const novo = fromRow(data);
    exames = [...exames, novo];
    // INSERT ecoa todos os campos via .select() — já é completo.
    _fullLoaded.add(novo.id);
    notify();
    return novo;
  } catch (e) {
    showError(e, { scope: "exameCatalogoStore.add" });
    return null;
  }
}

export async function updateExameCatalogo(id: string, data: Partial<ExameCatalogo>): Promise<boolean> {
  const prev = exames;
  exames = exames.map(e => e.id === id ? { ...e, ...data } : e);
  notify();
  try {
    // Persiste e relê o registro autoritativo do banco para sincronizar
    // qualquer normalização aplicada por triggers/defaults (evita drift de cache).
    const fresh = await persistOneOrThrow<any>(
      supabase.from("exames_catalogo").update(toRow(data)).eq("id", id),
      "exameCatalogo.update",
    );
    if (fresh) {
      const norm = fromRow(fresh);
      exames = exames.map(e => e.id === id ? norm : e);
      // UPDATE ecoa o registro completo via .select() — promove a completo.
      _fullLoaded.add(id);
      notify();
    }
    return true;
  } catch (e) {
    showError(e, { scope: "exameCatalogoStore.update" });
    exames = prev;
    notify();
    return false;
  }
}

export async function removeExameCatalogo(id: string): Promise<boolean> {
  const prev = exames;
  exames = exames.filter(e => e.id !== id);
  _fullLoaded.delete(id);
  notify();
  try {
    await persistOrThrow(
      supabase.from("exames_catalogo").delete().eq("id", id),
      "exameCatalogo.remove",
    );
    return true;
  } catch (e) {
    showError(e, { scope: "exameCatalogoStore.remove" });
    exames = prev;
    notify();
    return false;
  }
}

export async function toggleExameCatalogo(id: string): Promise<boolean> {
  const e = exames.find(x => x.id === id);
  if (!e) return false;
  return updateExameCatalogo(id, { ativo: !e.ativo });
}

export function subscribeExamesCatalogo(listener: () => void) {
  _listeners.push(listener);
  return () => { _listeners = _listeners.filter((l) => l !== listener); };
}
