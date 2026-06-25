// Persists lab identity (logo + business data) used in PDFs and printable
// documents.
//
// SOURCE OF TRUTH: tabela `tenant_lab_config` no Supabase (1 linha por tenant,
// isolada por RLS via current_tenant_id()).
//
// CACHE: localStorage espelha a última versão lida do banco para que os
// consumidores síncronos (documentoRenderer, comprovantes, dialogs) continuem
// funcionando sem precisar await. O cache é hidratado no boot
// (`loadLabConfigFromDb`) e atualizado em cada `saveLabConfig`.

import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/db/tenantResolver";
import { DEFAULT_WATERMARK, normalizeWatermark, type WatermarkConfig } from "@/lib/watermark";

const STORAGE_KEY = "sislac:labConfig";

export interface LabConfig {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  estado: string;
  cidade: string;
  endereco: string;
  /** base64 data URL (data:image/png;base64,...) — legado/fallback.
   *  Novas escritas usam `logoKey` (S3). */
  logo: string | null;
  /** Chave S3 do logo (`{cnpj}/_globais/logo/...`). Quando presente, é a fonte de verdade. */
  logoKey: string | null;
  /** Razão social (quando diferente do nome fantasia) */
  razaoSocial: string;
  /** Inscrição municipal */
  inscricaoMunicipal: string;
  /** Cadastro Nacional de Estabelecimentos de Saúde (CNES) */
  cnes: string;
  /** Nome do Responsável Técnico (RT) */
  responsavelTecnico: string;
  /** Conselho do RT (CRBM, CRF, CRM, CRBio…) */
  responsavelTecnicoConselho: string;
  /** Número do registro no conselho */
  responsavelTecnicoNumero: string;
  /** UF do conselho do RT */
  responsavelTecnicoUf: string;
  /** Marca d'água global (laudos, comprovantes, orçamentos…). */
  watermark: WatermarkConfig;
}

const defaultConfig: LabConfig = {
  nome: "SISLAC",
  cnpj: "",
  telefone: "",
  email: "",
  estado: "",
  cidade: "",
  endereco: "",
  logo: null,
  logoKey: null,
  razaoSocial: "",
  inscricaoMunicipal: "",
  cnes: "",
  responsavelTecnico: "",
  responsavelTecnicoConselho: "",
  responsavelTecnicoNumero: "",
  responsavelTecnicoUf: "",
  watermark: { ...DEFAULT_WATERMARK },
};

let _listeners: Array<() => void> = [];

function read(): LabConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultConfig };
    return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    return { ...defaultConfig };
  }
}

export function getLabConfig(): LabConfig {
  return read();
}

/** Atualiza apenas o cache local (sem tocar no banco). Usado por `loadLabConfigFromDb`. */
function writeCache(config: LabConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    _listeners.forEach((fn) => fn());
  } catch {
    /* ignore quota errors */
  }
}

/** Mapeia colunas snake_case do banco para o shape camelCase do app. */
function rowToConfig(row: Record<string, unknown>): LabConfig {
  return {
    nome: (row.nome as string) ?? "",
    cnpj: (row.cnpj as string) ?? "",
    telefone: (row.telefone as string) ?? "",
    email: (row.email as string) ?? "",
    estado: (row.estado as string) ?? "",
    cidade: (row.cidade as string) ?? "",
    endereco: (row.endereco as string) ?? "",
    logo: (row.logo as string | null) ?? null,
    logoKey: (row.logo_key as string | null) ?? null,
    razaoSocial: (row.razao_social as string) ?? "",
    inscricaoMunicipal: (row.inscricao_municipal as string) ?? "",
    cnes: (row.cnes as string) ?? "",
    responsavelTecnico: (row.responsavel_tecnico as string) ?? "",
    responsavelTecnicoConselho: (row.responsavel_tecnico_conselho as string) ?? "",
    responsavelTecnicoNumero: (row.responsavel_tecnico_numero as string) ?? "",
    responsavelTecnicoUf: (row.responsavel_tecnico_uf as string) ?? "",
    watermark: normalizeWatermark(row.watermark),
  };
}

function configToRow(config: LabConfig, tenantId: string) {
  return {
    tenant_id: tenantId,
    nome: config.nome ?? "",
    cnpj: config.cnpj ?? "",
    telefone: config.telefone ?? "",
    email: config.email ?? "",
    estado: config.estado ?? "",
    cidade: config.cidade ?? "",
    endereco: config.endereco ?? "",
    logo: config.logo,
    logo_key: config.logoKey ?? null,
    razao_social: config.razaoSocial ?? "",
    inscricao_municipal: config.inscricaoMunicipal ?? "",
    cnes: config.cnes ?? "",
    responsavel_tecnico: config.responsavelTecnico ?? "",
    responsavel_tecnico_conselho: config.responsavelTecnicoConselho ?? "",
    responsavel_tecnico_numero: config.responsavelTecnicoNumero ?? "",
    responsavel_tecnico_uf: config.responsavelTecnicoUf ?? "",
    watermark: normalizeWatermark(config.watermark),
  };
}

/**
 * Hidrata o cache local a partir do banco. Chamada no boot (após auth) e
 * sempre que o tenant ativo mudar. Em caso de erro/usuário sem tenant,
 * mantém o cache atual sem lançar.
 */
export async function loadLabConfigFromDb(): Promise<LabConfig> {
  try {
    const { data, error } = await supabase
      .from("tenant_lab_config")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    if (!data) return read();
    const cfg = rowToConfig(data as Record<string, unknown>);
    writeCache(cfg);
    // Hidrata logo do S3 em background para alimentar consumidores síncronos.
    if (cfg.logoKey && !cfg.logo) {
      void ensureLabLogoLoaded().catch(() => { /* noop */ });
    }
    return cfg;
  } catch {
    return read();
  }
}

/**
 * Persiste no banco (upsert por tenant_id) e atualiza o cache local.
 * Lança erro para que a UI consiga exibir feedback.
 */
export async function saveLabConfig(config: LabConfig): Promise<LabConfig> {
  const tenantId = await getCurrentTenantId();
  const row = configToRow(config, tenantId);
  const { data, error } = await supabase
    .from("tenant_lab_config")
    .upsert(row as never, { onConflict: "tenant_id" })
    .select()
    .single();
  if (error) throw error;
  const saved = rowToConfig(data as Record<string, unknown>);
  writeCache(saved);
  return saved;
}

/**
 * @deprecated mantido por compatibilidade com chamadas síncronas legadas.
 * Prefira `saveLabConfig` (async) que persiste no banco.
 */
export function setLabConfig(config: LabConfig): void {
  writeCache(config);
  // Tenta persistir em background — silencioso por compatibilidade.
  void saveLabConfig(config).catch(() => { /* noop */ });
}

export function subscribeLabConfig(listener: () => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

// ---------------------------------------------------------------------------
// Resolução assíncrona do logo (S3 → data URL para consumidores síncronos)
// ---------------------------------------------------------------------------

let _logoCache: { key: string; dataUrl: string; expiresAt: number } | null = null;
let _logoInflight: Promise<string | null> | null = null;

async function fetchLogoDataUrl(key: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("image-url", { body: { key } });
  if (error || !data?.url) return null;
  const res = await fetch(data.url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return await new Promise<string | null>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string) ?? null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}

/**
 * Garante que o `logo` (data URL) esteja disponível em memória para uso síncrono
 * por renderizadores de PDF/HTML. Se houver `logoKey`, baixa do S3 e injeta no
 * cache do `getLabConfig()`. Idempotente; cacheia por 50 min.
 */
export async function ensureLabLogoLoaded(): Promise<string | null> {
  const cfg = read();
  if (cfg.logo) return cfg.logo;
  if (!cfg.logoKey) return null;
  const now = Date.now();
  if (_logoCache && _logoCache.key === cfg.logoKey && _logoCache.expiresAt > now) {
    if (!read().logo) writeCache({ ...read(), logo: _logoCache.dataUrl });
    return _logoCache.dataUrl;
  }
  if (!_logoInflight) {
    _logoInflight = fetchLogoDataUrl(cfg.logoKey).finally(() => { _logoInflight = null; });
  }
  const dataUrl = await _logoInflight;
  if (!dataUrl) return null;
  _logoCache = { key: cfg.logoKey, dataUrl, expiresAt: now + 50 * 60 * 1000 };
  writeCache({ ...read(), logo: dataUrl });
  return dataUrl;
}

export function clearLabLogoCache(): void {
  _logoCache = null;
}
