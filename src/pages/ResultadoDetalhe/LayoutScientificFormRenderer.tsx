// ============================================================================
// LayoutScientificFormRenderer
// ----------------------------------------------------------------------------
// Renderiza LITERALMENTE o HTML do layout científico (CKEditor) na tela de
// digitação de resultados, substituindo placeholders inline:
//
//   ##CHAVE##      → input tipado do parâmetro (ParamTypedInput)
//   ##REF_X##      → faixa de referência clínica resolvida (sexo/idade)
//   ##UNID_X##     → unidade de referência
//   ##FLAG_X##     → indicador "↑/↓/—" comparando valor x faixa
//
// Esta abordagem preserva 100% da estrutura desenhada pelo administrador no
// editor científico (séries, colunas pareadas %/absoluto, agrupamentos, etc.),
// respeitando o layout padrão clínico de cada exame.
//
// Usado APENAS em modo de digitação (edição/retificação). Modo consulta e
// mobile mantêm a renderização atual em tabela própria.
// ============================================================================
import React, { Fragment, useEffect, useMemo, useRef } from "react";
import { AlertOctagon } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { ParamTypedInput } from "./ParamTypedInput";
import type { Parametro } from "./types";
import type { NivelCritico } from "@/domains/result/services/criticoChecker";
import { toast } from "@/hooks/use-toast";

/** Regex que casa elementos cujo conteúdo de texto é exatamente um único placeholder. */
const ALONE_PLACEHOLDER_RE = /^\s*##[A-Za-z0-9_+\-.]+##\s*$/;

interface ResolvedRef {
  refMin: string;
  refMax: string;
  refUnidade: string;
  descricao: string;
}

export interface LayoutScientificFormRendererProps {
  layoutHtml: string;
  parametros: Parametro[];
  /** Disparado ao alterar o valor; idx é o índice em `parametros`. */
  onChangeParam: (idx: number, valor: string) => void;
  /** Resolve a referência clínica (sexo/idade já aplicados) para o parâmetro. */
  getResolvedRef: (param: Parametro) => ResolvedRef;
  /** Calcula valor de fórmulas (ex.: V.C.M) para parâmetros do tipo Formula. */
  evaluateFormulaFor: (param: Parametro) => string;
  /** Avalia se o valor está em faixa crítica (pânico). */
  avaliarNivelCritico: (paramNome: string, valor: string) => NivelCritico;
  disabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                 */
/* -------------------------------------------------------------------------- */

const PLACEHOLDER_RE = /##([A-Za-z0-9_+\-.]+)##/g;
const upper = (s: string | undefined | null) => (s ?? "").trim().toUpperCase();

/** Converte uma string CSS inline (kebab-case) em um objeto React (camelCase). */
function parseStyle(str: string | null | undefined): React.CSSProperties {
  const out: Record<string, string> = {};
  if (!str) return out;
  str.split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const value = decl.slice(i + 1).trim();
    if (!prop || !value) return;
    const cam = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[cam] = value;
  });
  return out as React.CSSProperties;
}

/** Mapeamento mínimo de atributos HTML → props React preservando o layout. */
function buildReactProps(el: Element): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name;
    const value = attr.value;
    switch (name) {
      case "class":
        props.className = value;
        break;
      case "style":
        props.style = parseStyle(value);
        break;
      case "colspan":
        props.colSpan = parseInt(value, 10) || undefined;
        break;
      case "rowspan":
        props.rowSpan = parseInt(value, 10) || undefined;
        break;
      case "valign":
        // não suportado em React; passa via style
        props.style = { ...(props.style as object), verticalAlign: value };
        break;
      default:
        // Atributos seguros e que React aceita lowercase
        if (/^(width|height|align|dir|lang|title)$/.test(name)) {
          props[name] = value;
        }
        break;
    }
  }
  return props;
}

const SUPPORTED_TAGS = new Set([
  "figure", "table", "colgroup", "col", "thead", "tbody", "tfoot",
  "tr", "td", "th", "caption",
  "span", "p", "div", "br", "strong", "b", "em", "i", "u", "small", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "hr",
]);

/* -------------------------------------------------------------------------- */
/* Componente principal                                                        */
/* -------------------------------------------------------------------------- */

// IMPORTANTE: o prop NÃO pode se chamar `ref` — em React isso é reservado
// para forwardRef e não é entregue como prop comum. Use `resolved`.
const RefText: React.FC<{ resolved?: ResolvedRef | null }> = ({ resolved }) => {
  if (!resolved) return <span className="text-muted-foreground italic">—</span>;
  if (resolved.refMin || resolved.refMax) {
    if (resolved.refMin && resolved.refMax) {
      return <span className="text-foreground">{resolved.refMin} - {resolved.refMax}</span>;
    }
    return <span className="text-foreground">{resolved.refMin || resolved.refMax}</span>;
  }
  if (resolved.descricao) {
    return <span className="text-foreground whitespace-pre-line">{resolved.descricao}</span>;
  }
  return <span className="text-muted-foreground italic">—</span>;
};

const FlagSymbol: React.FC<{ resolved?: ResolvedRef | null; valor: string }> = ({ resolved, valor }) => {
  if (!resolved) return null;
  const v = parseFloat((valor || "").replace(",", "."));
  const lo = parseFloat((resolved.refMin || "").replace(",", "."));
  const hi = parseFloat((resolved.refMax || "").replace(",", "."));
  if (!isFinite(v)) return null;
  if (isFinite(lo) && v < lo) return <span className="text-status-danger font-bold ml-1">↓</span>;
  if (isFinite(hi) && v > hi) return <span className="text-status-danger font-bold ml-1">↑</span>;
  return null;
};

export const LayoutScientificFormRenderer: React.FC<LayoutScientificFormRendererProps> = ({
  layoutHtml,
  parametros,
  onChangeParam,
  getResolvedRef,
  evaluateFormulaFor,
  avaliarNivelCritico,
  disabled,
}) => {
  // Mapa: chave/abreviação/rótulo (UPPER) → índice no array `parametros`.
  const paramIndexByKey = useMemo(() => {
    const m = new Map<string, number>();
    parametros.forEach((p, idx) => {
      if (p.chave) m.set(upper(p.chave), idx);
      // (rotulo/nome também, defesa contra layouts antigos que usem rótulo)
      if (p.rotulo) m.set(upper(p.rotulo), idx);
      if (p.nome) m.set(upper(p.nome), idx);
    });
    return m;
  }, [parametros]);

  // Parse do HTML em árvore DOM real do navegador.
  const rootDoc = useMemo(() => {
    const safe = sanitizeHtml(layoutHtml);
    const parser = new DOMParser();
    // Embrulha em <body> para garantir parsing como fragmento.
    const doc = parser.parseFromString(`<!doctype html><body>${safe}</body>`, "text/html");
    return doc.body;
  }, [layoutHtml]);

  /* ----- Contador da SÉRIE BRANCA (chave CONT) -----
     Regra clínica: a soma dos diferenciais leucocitários deve ser exatamente 100.
       • = 100 → verde (ok)
       • ≠ 100 → vermelho (ainda incompleto OU excedeu)
       • > 100 → dispara alerta (toast), mas NUNCA bloqueia digitação/salvamento. */
  const contIdx = paramIndexByKey.get("CONT");
  const contParam = contIdx != null ? parametros[contIdx] : undefined;
  const contValue = contParam
    ? (contParam.tipo === "Formula" ? evaluateFormulaFor(contParam) : contParam.valor)
    : "";
  const contNumeric = parseFloat((contValue || "").replace(",", "."));
  // Verde = exatamente 100; Amarelo = 99 ou 101 (tolerância opcional);
  // Vermelho = qualquer outro valor (incluindo vazio/incompleto).
  const contStatus: "success" | "warning" | "danger" | undefined = contParam
    ? (isFinite(contNumeric) && contNumeric === 100
        ? "success"
        : isFinite(contNumeric) && (contNumeric === 99 || contNumeric === 101)
        ? "warning"
        : "danger")
    : undefined;
  const lastOverRef = useRef(false);
  useEffect(() => {
    const over = isFinite(contNumeric) && contNumeric > 100;
    if (over && !lastOverRef.current) {
      toast({
        variant: "destructive",
        title: "Soma da série branca excede 100",
        description: `Total atual: ${contNumeric}. O ideal é exatamente 100. Ajuste os diferenciais — você pode continuar a digitação e salvar.`,
      });
    }
    lastOverRef.current = over;
  }, [contNumeric]);


  /* ----- Conversão recursiva DOM → React ----- */

  const renderTextWithPlaceholders = (text: string, keyPrefix: string, isAlone: boolean): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    PLACEHOLDER_RE.lastIndex = 0;
    let n = 0;
    while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
      if (m.index > lastIndex) {
        out.push(text.slice(lastIndex, m.index));
      }
      const key = m[1];
      const upKey = key.toUpperCase();
      const placeholderKey = `${keyPrefix}-ph-${n++}`;

      if (upKey.startsWith("REF_")) {
        const target = upKey.slice(4);
        const idx = paramIndexByKey.get(target);
        if (idx != null) {
          const param = parametros[idx];
          out.push(<RefText key={placeholderKey} resolved={getResolvedRef(param)} />);
        }
      } else if (upKey.startsWith("UNID_")) {
        const target = upKey.slice(5);
        const idx = paramIndexByKey.get(target);
        if (idx != null) {
          const param = parametros[idx];
          const ref = getResolvedRef(param);
          const txt = (ref?.refUnidade) || param.unidade || "";
          out.push(<span key={placeholderKey} className="text-muted-foreground">{txt}</span>);
        }
      } else if (upKey.startsWith("FLAG_")) {
        const target = upKey.slice(5);
        const idx = paramIndexByKey.get(target);
        if (idx != null) {
          const param = parametros[idx];
          const valor = param.tipo === "Formula" ? evaluateFormulaFor(param) : param.valor;
          out.push(<FlagSymbol key={placeholderKey} resolved={getResolvedRef(param)} valor={valor} />);
        }
      } else {
        const idx = paramIndexByKey.get(upKey);
        if (idx != null) {
          const param = parametros[idx];
          const computed = param.tipo === "Formula" ? evaluateFormulaFor(param) : "";
          const valorAtual = param.tipo === "Formula" ? computed : param.valor;
          const nivel = avaliarNivelCritico(param.nome, valorAtual);
          const isCritico = nivel !== "normal";
          // CONT (contador da série branca): cor semântica baseada na soma.
          const isCont = upper(param.chave) === "CONT";
          const statusColor = isCont ? contStatus : undefined;
          // Quando o placeholder ocupa sozinho um elemento (linha), o input
          // expande para preencher todo o espaço disponível do layout.
          const sizeClass = isAlone
            ? "w-full h-9 py-1"
            : "w-24 sm:w-28 h-9 py-1";
          out.push(
            <span
              key={placeholderKey}
              className={`${isAlone ? "flex w-full" : "inline-flex"} items-center align-middle gap-1`}
            >
              <ParamTypedInput
                param={param}
                isCritico={isCritico && !statusColor}
                statusColor={statusColor}
                computedValue={computed}
                onChange={(v) => onChangeParam(idx, v)}
                disabled={disabled}
                className={sizeClass}
              />
              {isCritico && !statusColor && (
                <AlertOctagon
                  className="h-3.5 w-3.5 text-status-danger animate-pulse shrink-0"
                  aria-label={nivel === "critico_baixo" ? "Crítico baixo" : "Crítico alto"}
                />
              )}
            </span>,
          );
        } else {
          // Placeholder desconhecido — preserva o token (ajuda em diagnóstico).
          out.push(`##${key}##`);
        }
      }
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < text.length) {
      out.push(text.slice(lastIndex));
    }
    return out;
  };

  const renderNode = (node: Node, keyPrefix: string, isAlone: boolean): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? "";
      if (!txt) return null;
      if (!txt.includes("##")) return txt;
      return <Fragment key={keyPrefix}>{renderTextWithPlaceholders(txt, keyPrefix, isAlone)}</Fragment>;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    // Detecta se este elemento "hospeda" um único placeholder — nesse caso,
    // o input renderizado deve preencher 100% da largura disponível.
    const aloneHere =
      isAlone ||
      (["td", "th", "p", "div", "li"].includes(tag) &&
        ALONE_PLACEHOLDER_RE.test(el.textContent ?? ""));
    if (!SUPPORTED_TAGS.has(tag)) {
      return <Fragment key={keyPrefix}>{renderChildren(el, keyPrefix, aloneHere)}</Fragment>;
    }
    const props = buildReactProps(el);
    props.key = keyPrefix;

    // Tags void / sem filhos
    if (tag === "br" || tag === "hr" || tag === "col") {
      return React.createElement(tag, props);
    }
    return React.createElement(tag, props, renderChildren(el, keyPrefix, aloneHere));
  };

  const renderChildren = (el: Element, keyPrefix: string, isAlone: boolean): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    el.childNodes.forEach((child, i) => {
      const r = renderNode(child, `${keyPrefix}-${i}`, isAlone);
      if (r != null && r !== "") out.push(r);
    });
    return out;
  };

  const tree = renderChildren(rootDoc, "lsr", false);

  return (
    <div className="layout-scientific-form text-sm text-foreground">
      <style>{`
        .layout-scientific-form table { width: 100%; border-collapse: collapse; }
        .layout-scientific-form td, .layout-scientific-form th { vertical-align: middle; }
        .layout-scientific-form figure.table { margin: 0; }
      `}</style>
      {tree}
    </div>
  );
};

export default LayoutScientificFormRenderer;
