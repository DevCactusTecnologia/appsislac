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
import React, { Fragment, useMemo } from "react";
import { AlertOctagon } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitizeHtml";
import { ParamTypedInput } from "./ParamTypedInput";
import type { Parametro } from "./types";
import type { NivelCritico } from "@/lib/criticoChecker";

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

const RefText: React.FC<{ ref: ResolvedRef }> = ({ ref }) => {
  if (ref.refMin || ref.refMax) {
    if (ref.refMin && ref.refMax) {
      return <span className="text-foreground">{ref.refMin} - {ref.refMax}</span>;
    }
    return <span className="text-foreground">{ref.refMin || ref.refMax}</span>;
  }
  if (ref.descricao) {
    return <span className="text-foreground whitespace-pre-line">{ref.descricao}</span>;
  }
  return <span className="text-muted-foreground italic">—</span>;
};

const FlagSymbol: React.FC<{ ref: ResolvedRef; valor: string }> = ({ ref, valor }) => {
  const v = parseFloat((valor || "").replace(",", "."));
  const lo = parseFloat((ref.refMin || "").replace(",", "."));
  const hi = parseFloat((ref.refMax || "").replace(",", "."));
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

  /* ----- Conversão recursiva DOM → React ----- */

  const renderTextWithPlaceholders = (text: string, keyPrefix: string): React.ReactNode[] => {
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
          out.push(<RefText key={placeholderKey} ref={getResolvedRef(param)} />);
        }
      } else if (upKey.startsWith("UNID_")) {
        const target = upKey.slice(5);
        const idx = paramIndexByKey.get(target);
        if (idx != null) {
          const param = parametros[idx];
          const ref = getResolvedRef(param);
          const txt = ref.refUnidade || param.unidade || "";
          out.push(<span key={placeholderKey} className="text-muted-foreground">{txt}</span>);
        }
      } else if (upKey.startsWith("FLAG_")) {
        const target = upKey.slice(5);
        const idx = paramIndexByKey.get(target);
        if (idx != null) {
          const param = parametros[idx];
          const valor = param.tipo === "Formula" ? evaluateFormulaFor(param) : param.valor;
          out.push(<FlagSymbol key={placeholderKey} ref={getResolvedRef(param)} valor={valor} />);
        }
      } else {
        const idx = paramIndexByKey.get(upKey);
        if (idx != null) {
          const param = parametros[idx];
          const computed = param.tipo === "Formula" ? evaluateFormulaFor(param) : "";
          const valorAtual = param.tipo === "Formula" ? computed : param.valor;
          const nivel = avaliarNivelCritico(param.nome, valorAtual);
          const isCritico = nivel !== "normal";
          out.push(
            <span key={placeholderKey} className="inline-flex items-center align-middle gap-1">
              <ParamTypedInput
                param={param}
                isCritico={isCritico}
                computedValue={computed}
                onChange={(v) => onChangeParam(idx, v)}
                disabled={disabled}
                className="w-24 sm:w-28 h-9 py-1"
              />
              {isCritico && (
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

  const renderNode = (node: Node, keyPrefix: string): React.ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) {
      const txt = node.textContent ?? "";
      if (!txt) return null;
      if (!txt.includes("##")) return txt;
      return <Fragment key={keyPrefix}>{renderTextWithPlaceholders(txt, keyPrefix)}</Fragment>;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (!SUPPORTED_TAGS.has(tag)) {
      // tag não suportada → renderiza apenas filhos
      return <Fragment key={keyPrefix}>{renderChildren(el, keyPrefix)}</Fragment>;
    }
    const props = buildReactProps(el);
    props.key = keyPrefix;

    // Tags void / sem filhos
    if (tag === "br" || tag === "hr" || tag === "col") {
      return React.createElement(tag, props);
    }
    return React.createElement(tag, props, renderChildren(el, keyPrefix));
  };

  const renderChildren = (el: Element, keyPrefix: string): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    el.childNodes.forEach((child, i) => {
      const r = renderNode(child, `${keyPrefix}-${i}`);
      if (r != null && r !== "") out.push(r);
    });
    return out;
  };

  const tree = renderChildren(rootDoc, "lsr");

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
