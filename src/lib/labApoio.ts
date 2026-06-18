// Utilitários puros relacionados a Laboratórios de Apoio (multi-lab routing).
// Feito de forma ADITIVA — não altera contratos existentes.

/** Tipos de processo já usados no sistema. */
export type TipoProcesso = "INTERNO" | "TERCEIRIZADO";

/** Mínimo necessário para roteamento — abstrai LabApoio do store. */
export interface LabApoioLite {
  id: string;
  nome: string;
  ativo?: boolean;
}

/**
 * Gera uma sigla curta (até 6 chars) a partir do nome do laboratório.
 * Ex.: "DASA Diagnóstico" → "DASA";  "Hermes Pardini" → "HEPA"; "Sabin" → "SABIN".
 */
export function siglaLab(nome: string | null | undefined): string {
  const s = (nome ?? "").trim();
  if (!s) return "—";
  const cleaned = s.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const palavras = cleaned.split(/\s+/).filter(Boolean);
  if (palavras.length === 1) {
    const w = palavras[0].toUpperCase();
    return w.length <= 6 ? w : w.slice(0, 5);
  }
  // Pega 2 letras das duas primeiras palavras significativas
  const a = palavras[0].slice(0, 2).toUpperCase();
  const b = palavras[1].slice(0, 2).toUpperCase();
  return (a + b).slice(0, 6);
}

/**
 * Hash determinístico estável → cor HSL consistente por id de laboratório.
 * Uma cor por lab — útil para badges e impressão organizada por destino.
 */
export function corLab(idOrNome: string): { bg: string; fg: string; hue: number } {
  let h = 0;
  const src = idOrNome || "lab";
  for (let i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  // Saturação/luminosidade fixas para garantir contraste estável
  return {
    bg: `hsl(${hue} 80% 92%)`,
    fg: `hsl(${hue} 70% 28%)`,
    hue,
  };
}

/**
 * Resolve o destino lógico (label + cor) de um exame.
 * Se for INTERNO, devolve identidade do laboratório próprio (nome do tenant) caso fornecido.
 */
export function resolveDestino(opts: {
  tipoProcesso: TipoProcesso | string | null | undefined;
  labApoioId?: string | null;
  labApoioNome?: string | null;
  labApoioSigla?: string | null;
  laboratorioPropriaNome?: string | null;
}): { label: string; sigla: string; cor: ReturnType<typeof corLab>; tipo: TipoProcesso } {
  const isExterno = (opts.tipoProcesso ?? "INTERNO") === "TERCEIRIZADO";
  if (isExterno) {
    const nome = opts.labApoioNome ?? "Lab apoio";
    const id = opts.labApoioId ?? nome;
    const siglaCadastrada = (opts.labApoioSigla ?? "").trim();
    return {
      label: nome,
      sigla: siglaCadastrada || siglaLab(nome),
      cor: corLab(id),
      tipo: "TERCEIRIZADO",
    };
  }
  const nome = opts.laboratorioPropriaNome?.trim() || "INTERNO";
  return {
    label: nome,
    sigla: siglaLab(nome),
    cor: corLab(`internal:${nome}`),
    tipo: "INTERNO",
  };
}

/**
 * Cria uma chave de roteamento "1 amostra = 1 lab".
 *
 * Regra:
 *   - Exames INTERNOS compartilham chave entre si (`INTERNO`).
 *   - Exames TERCEIRIZADOS são particionados por `lab_apoio_id` — labs diferentes não compartilham tubo.
 *   - Quando lab_apoio_id está ausente em um terceirizado, isolamos por id do exame
 *     (não permite agrupar com nada — mais seguro que agrupar errado).
 */
export function chaveRoteamentoLab(input: {
  tipoProcesso?: TipoProcesso | string | null;
  labApoioId?: string | null;
  fallbackId?: string | number | null;
}): string {
  const tipo = input.tipoProcesso ?? "INTERNO";
  if (tipo === "TERCEIRIZADO") {
    return `EXT:${input.labApoioId ?? `unset-${input.fallbackId ?? Math.random()}`}`;
  }
  return "INT";
}

/**
 * Agrupa exames respeitando a regra "1 amostra = 1 lab".
 * Recebe a lista bruta de exames e devolve grupos prontos para gerar amostras separadas.
 *
 * NÃO conhece nada do banco — função pura, fácil de testar.
 */
export interface RoteavelExame {
  id: number | string;
  tipoProcesso?: TipoProcesso | string | null;
  labApoioId?: string | null;
  /** Identidade lógica do exame compartilhado — preserva agrupamento original quando possível. */
  grupoExameId?: string | null;
  /** Material físico do tubo — opcional, usado apenas para depuração/visualização. */
  material?: string | null;
}

export interface GrupoAmostra<T extends RoteavelExame> {
  /** Chave estável: combina grupoExameId (ou material) + chaveRoteamentoLab. */
  chave: string;
  labApoioId: string | null;
  tipoProcesso: TipoProcesso;
  exames: T[];
}

export function resolveAmostrasPorLab<T extends RoteavelExame>(exames: T[]): GrupoAmostra<T>[] {
  const map = new Map<string, GrupoAmostra<T>>();
  for (const ex of exames) {
    const tipo: TipoProcesso = (ex.tipoProcesso ?? "INTERNO") === "TERCEIRIZADO" ? "TERCEIRIZADO" : "INTERNO";
    const rota = chaveRoteamentoLab({
      tipoProcesso: tipo,
      labApoioId: ex.labApoioId ?? null,
      fallbackId: ex.id,
    });
    // Mantemos agrupamento por grupoExameId quando existe, particionado pelo lab.
    const grupo = ex.grupoExameId ?? `solo:${ex.id}`;
    const chave = `${grupo}|${rota}`;
    let bucket = map.get(chave);
    if (!bucket) {
      bucket = {
        chave,
        labApoioId: tipo === "TERCEIRIZADO" ? ex.labApoioId ?? null : null,
        tipoProcesso: tipo,
        exames: [],
      };
      map.set(chave, bucket);
    }
    bucket.exames.push(ex);
  }
  return Array.from(map.values());
}