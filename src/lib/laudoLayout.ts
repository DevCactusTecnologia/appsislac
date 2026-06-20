// Renderização de laudos baseada em layouts persistidos (exame_layouts + exame_parametros).
//
// Para cada exame:
//  1) Carrega o layout PADRÃO do exame (se existir) e seus parâmetros cadastrados.
//  2) Substitui placeholders no HTML do layout pelos valores reais salvos em
//     atendimento_exames.resultados (jsonb), suportando 4 formatos de chave:
//        ##CHAVE##   (recomendado, ex.: ##HEM01##)
//        #chave      (legacy, ex.: #parâmetro)
//        {{chave}}   (mustache)
//        {chave}     (curto)
//  3) Quando não existir layout cadastrado, retorna `null` para que o caller
//     use o fallback de tabela padrão.
//
// As lookups por nome do parâmetro tentam, nesta ordem:
//  - chave EXATA (case-sensitive)
//  - chave normalizada (minúsculas, sem #/##/{{ }} sobrando, sem acentos)
//  - rótulo do parâmetro cadastrado (ParametrosDialog.rotulo)
//  - rótulo normalizado
//
// Isso garante compatibilidade tanto com layouts feitos pelo editor (que usam
// o nome do parâmetro como placeholder) quanto com layouts que adotam a
// convenção ##CHAVE## importada de outros sistemas.

import { loadLayouts, type LayoutMargins } from "@/data/exameLayoutsStore";
import { loadParametros, ExameParametro } from "@/data/exameParametrosStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { resolverReferencia } from "@/data/valoresReferenciaStore";
import { preserveVisibleTextSpacing, splitPlaceholderSpacing } from "@/lib/htmlSpacing";

const DEFAULT_MARGINS: LayoutMargins = { top: 4, right: 11, bottom: 4, left: 11 };

const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[#{}]/g, "")
    .trim()
    .toLowerCase();

/** Parse numérico tolerante (vírgula/ponto). */
const parseNum = (s: string): number | null => {
  if (!s) return null;
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Compara valor com refMin/refMax e devolve a flag clínica. */
const flagFor = (valor: string, refMin: string, refMax: string): "↑" | "↓" | "" => {
  const v = parseNum(valor);
  const min = parseNum(refMin);
  const max = parseNum(refMax);
  if (v === null) return "";
  if (max !== null && v > max) return "↑";
  if (min !== null && v < min) return "↓";
  return "";
};

/**
 * Constrói o mapa lookup chave→valor para um exame, combinando:
 *  - resultados salvos (jsonb), indexados pelo NOME do parâmetro do template
 *  - parâmetros cadastrados em exame_parametros (chave + rotulo)
 *
 * O resultado contém as várias formas de localizar o mesmo valor: pela chave
 * exata, pela chave normalizada, pelo rótulo, etc.
 */
function buildValueMap(
  exameNome: string,
  resultados: Record<string, string>,
  parametrosCadastrados: ExameParametro[],
  pacienteSexo?: string,
  pacienteIdade?: string,
  pacienteExtra?: { nome?: string; nascimento?: string; cpf?: string; protocolo?: string },
): Record<string, string> {
  const map: Record<string, string> = {};

  const setBoth = (key: string, value: string) => {
    map[key] = value;
    map[norm(key)] = value;
  };

  // 0) Dados do paciente (placeholders globais do laudo)
  if (pacienteExtra?.nome) {
    setBoth("paciente.nome", pacienteExtra.nome);
    setBoth("PACIENTE_NOME", pacienteExtra.nome);
  }
  if (pacienteIdade) {
    setBoth("paciente.idade", pacienteIdade);
    setBoth("PACIENTE_IDADE", pacienteIdade);
    setBoth("IDADE", pacienteIdade);
  }
  if (pacienteSexo) {
    setBoth("paciente.sexo", pacienteSexo);
    setBoth("PACIENTE_SEXO", pacienteSexo);
  }
  if (pacienteExtra?.nascimento) {
    setBoth("paciente.nascimento", pacienteExtra.nascimento);
    setBoth("PACIENTE_NASCIMENTO", pacienteExtra.nascimento);
  }
  if (pacienteExtra?.cpf) {
    setBoth("paciente.cpf", pacienteExtra.cpf);
    setBoth("PACIENTE_CPF", pacienteExtra.cpf);
  }
  if (pacienteExtra?.protocolo) {
    setBoth("paciente.protocolo", pacienteExtra.protocolo);
    setBoth("PROTOCOLO", pacienteExtra.protocolo);
  }

  // 1) Resultados crus indexados pelo nome usado em runtime (ex.: "Hemoglobina").
  for (const [nome, valor] of Object.entries(resultados)) {
    setBoth(nome, valor ?? "");
  }

  // 2) Parâmetros cadastrados: cruza chave/abreviação/rótulo com os resultados
  //    e enriquece com placeholders especiais REF_/FLAG_ baseados em valores_referencia.
  for (const p of parametrosCadastrados) {
    const valor = resultados[p.rotulo] ?? resultados[p.chave] ?? resultados[p.abreviacao] ?? "";
    if (p.chave) setBoth(p.chave, valor);
    if (p.abreviacao) setBoth(p.abreviacao, valor);
    if (p.rotulo) setBoth(p.rotulo, valor);

    // Resolve referência clínica (sexo/idade do paciente, com fallback para Ambos).
    // Tenta casar parametro_nome por rótulo → chave → abreviação (case-insensitive),
    // garantindo compatibilidade tanto com VRs cadastradas pelo nome do parâmetro
    // quanto pela chave técnica do layout.
    let ref: ReturnType<typeof resolverReferencia> = null;
    if (pacienteSexo || pacienteIdade) {
      const candidatos = [p.rotulo, p.chave, p.abreviacao].filter(Boolean) as string[];
      for (const nome of candidatos) {
        ref = resolverReferencia(exameNome, nome, pacienteSexo ?? "", pacienteIdade ?? "");
        if (ref) break;
      }
    }

    // Prioriza `descricao` quando preenchida (permite texto livre por faixa,
    // ex.: "Normal: Inferior a 5.7%"). Caso contrário monta "min - max".
    // Quando não há VR estruturada, cai para o fallback global do parâmetro.
    const isDescricaoUtil = (d?: string) => {
      if (!d) return false;
      const trimmed = d.trim();
      if (!trimmed) return false;
      // descricao auto-gerada pela matriz ("Masculino • 12a+") não deve poluir o laudo
      return !/^(Masculino|Feminino|Ambos)\s*•/i.test(trimmed);
    };
    const refTexto = ref
      ? (isDescricaoUtil(ref.descricao)
          ? ref.descricao.trim()
          : (ref.refMin && ref.refMax
              ? `${ref.refMin} - ${ref.refMax}`
              : ref.refMin || ref.refMax || ""))
      : (p.valorReferencia || "");

    const refMin = ref?.refMin ?? "";
    const refMax = ref?.refMax ?? "";
    const flag = flagFor(valor, refMin, refMax);

    // Placeholders auxiliares — emitidos por chave, rótulo e abreviação
    // para que ##REF_HEMOGLOBINA## funcione mesmo quando o layout usa o
    // nome do parâmetro em vez da chave técnica.
    const refUnidade = ref?.refUnidade ?? "";
    const emitRef = (k?: string) => {
      if (!k) return;
      setBoth(`REF_${k}`, refTexto);
      setBoth(`FLAG_${k}`, flag);
      setBoth(`UNID_${k}`, refUnidade);
    };
    emitRef(p.chave);
    emitRef(p.rotulo);
    emitRef(p.abreviacao);
  }

  return map;
}

/**
 * Substitui ##CHAVE##, #chave, {{chave}} e {chave} no HTML pelo valor mapeado.
 *
 * Sintaxe oficial: `##CHAVE##`. As demais (`{{x}}`, `{x}`, `#x`) são
 * LEGACY_RESERVED e mantidas APENAS para retro-compatibilidade com layouts
 * e snapshots antigos. Não devem ser usadas em layouts novos.
 */
function applyPlaceholders(
  html: string,
  valueMap: Record<string, string>,
): string {
  const lookup = (raw: string): string => {
    if (raw in valueMap) return valueMap[raw];
    const n = norm(raw);
    if (n in valueMap) return valueMap[n];
    return ""; // placeholder não mapeado vira vazio (mantém limpo no laudo)
  };

  return html
    // ##CHAVE##  (não-greedy, aceita letras/números/_/- entre as ##)
    .replace(/##([^#]*?)##/g, (_, raw) => {
      const { leading, key, trailing } = splitPlaceholderSpacing(raw);
      return `${leading}${lookup(key)}${trailing}`;
    })
    // {{chave}}
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => lookup(key))
    // {chave}    (apenas se for token "limpo", evita conflito com CSS/JSON)
    .replace(/\{([A-Za-zÀ-ÿ0-9_#-]+?)\}/g, (m, key) => {
      const v = lookup(key);
      return v || m; // se não casou, devolve o token original (não estraga CSS inline)
    })
    // #chave  (token de uma palavra; usado pelo editor padrão "#parâmetro")
    .replace(/#([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9_-]*)/g, (m, key) => {
      const v = lookup(key);
      return v || m;
    });
}

/**
 * Renderiza o bloco HTML de UM exame usando seu layout padrão persistido.
 * Retorna `{ html: null, margins: DEFAULT_MARGINS }` quando o exame não tem
 * layout cadastrado — nesse caso o caller deve cair para o renderizador de
 * tabela padrão.
 */
export async function renderExameComLayout(
  exameNome: string,
  resultados: Record<string, string>,
  pacienteSexo?: string,
  pacienteIdade?: string,
  pacienteExtra?: { nome?: string; nascimento?: string; cpf?: string; protocolo?: string },
): Promise<{ html: string | null; margins: LayoutMargins }> {
  const catalogo = getExamesCatalogo().find((c) => c.nome === exameNome);
  if (!catalogo) {
    return { html: null, margins: DEFAULT_MARGINS };
  }

  const [layouts, parametros] = await Promise.all([
    loadLayouts(catalogo.id),
    loadParametros(catalogo.id),
  ]);

  const layoutPadrao = layouts.find((l) => l.padrao) ?? layouts[0];
  if (!layoutPadrao || !layoutPadrao.conteudo?.trim()) {
    return { html: null, margins: DEFAULT_MARGINS };
  }

  const valueMap = buildValueMap(exameNome, resultados, parametros, pacienteSexo, pacienteIdade, pacienteExtra);
  const corpo = preserveVisibleTextSpacing(applyPlaceholders(layoutPadrao.conteudo, valueMap));

  // Respeita as margens definidas pelo usuário no layout (config.margins).
  // Faz merge com DEFAULT_MARGINS para preencher campos ausentes.
  const cfgMargins = layoutPadrao.config?.margins;
  const margins: LayoutMargins = cfgMargins
    ? {
        top: Number.isFinite(cfgMargins.top) ? cfgMargins.top : DEFAULT_MARGINS.top,
        right: Number.isFinite(cfgMargins.right) ? cfgMargins.right : DEFAULT_MARGINS.right,
        bottom: Number.isFinite(cfgMargins.bottom) ? cfgMargins.bottom : DEFAULT_MARGINS.bottom,
        left: Number.isFinite(cfgMargins.left) ? cfgMargins.left : DEFAULT_MARGINS.left,
      }
    : DEFAULT_MARGINS;

  // Força Courier no corpo dos resultados (espelhando o padrão do laudo de referência),
  // mantendo Helvetica no título do exame.
  const html = `<div class="exame-bloco-custom" style="margin-bottom:20px;page-break-inside:avoid;font-family:'Courier New',Courier,monospace;white-space:break-spaces;"><div style="font-size:10pt;font-weight:700;color:#000000;padding-bottom:0;margin-bottom:2px;font-family:Helvetica,Arial,sans-serif;white-space:normal;">${exameNome}</div><div style="font-size:9pt;line-height:1.4;color:#1a1a2e;font-family:'Courier New',Courier,monospace;white-space:break-spaces;">${corpo.replace(/^\s+/, "").replace(/\s+$/, "")}</div></div>`;
  return { html, margins };
}

/** Pré-carrega layouts/parâmetros de uma lista de nomes de exame em paralelo. */
export async function preloadLayoutsParaExames(exameNomes: string[]): Promise<void> {
  const catalogo = getExamesCatalogo();
  const ids = exameNomes
    .map((n) => catalogo.find((c) => c.nome === n)?.id)
    .filter((id): id is string => !!id);
  await Promise.all(
    ids.flatMap((id) => [loadLayouts(id), loadParametros(id)]),
  );
}
