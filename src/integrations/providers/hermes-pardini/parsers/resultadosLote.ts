/**
 * Parser do XML de retorno "Resultados v1.2" — Hermes Pardini.
 *
 * Baseado integralmente no schema Resultados.xsd e no Manual de Consulta
 * de Pacientes e Resultados (IHP). Tolerante a:
 *  - prefixos de namespace (`hp:`, `ns2:`, etc.)
 *  - CDATA (laudo embrulhado em `<resultadoXml><![CDATA[...]]></resultadoXml>`)
 *  - elementos opcionais e atributos em qualquer ordem
 *
 * Não usa libs externas (compatível com browser e Deno edge).
 */

import type {
  ControleDeLote,
  ExameResultado,
  GetResultadoOutput,
  InfAdicional,
  InfAdicionalValor,
  ItemDeExame,
  ParsedResponse,
  PedidoResultado,
  PeriodoResultados,
  ResultadoExameDTO,
  ResultadoItem,
  ResultadosLote,
  SuperExameResultado,
  ValorDeReferencia,
  ValorReferenciaLinha,
  ValorResultado,
} from "../dto";

// ---------------------------- debug logger --------------------------------

/**
 * Acumulador leve de eventos de parsing. Usado para devolver diagnóstico
 * estruturado em `ParsedResponse.debug` e — quando `globalThis.__HP_DEBUG_PARSE__`
 * estiver ativo — espelhar via `console.debug`.
 */
export class ParseDebug {
  readonly events: string[] = [];
  private readonly mirror: boolean;
  constructor(mirror?: boolean) {
    this.mirror = mirror ?? !!(globalThis as { __HP_DEBUG_PARSE__?: boolean })
      .__HP_DEBUG_PARSE__;
  }
  log(level: "info" | "warn" | "error", msg: string, extra?: unknown) {
    const line =
      `[hp-parse:${level}] ${msg}` +
      (extra !== undefined ? ` :: ${safeJson(extra)}` : "");
    this.events.push(line);
    if (this.mirror) {
      const fn =
        level === "error" ? console.error : level === "warn" ? console.warn : console.debug;
      fn(line);
    }
  }
  info(msg: string, extra?: unknown) { this.log("info", msg, extra); }
  warn(msg: string, extra?: unknown) { this.log("warn", msg, extra); }
  error(msg: string, extra?: unknown) { this.log("error", msg, extra); }
}

function safeJson(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s.length > 240 ? `${s.slice(0, 237)}…` : s;
  } catch {
    return String(v);
  }
}

// ---------------------------- helpers XML ---------------------------------

/** Remove prefixos de namespace (`hp:tag` → `tag`). */
export function stripNs(xml: string): string {
  return xml.replace(/<\/?[A-Za-z_][\w.-]*:/g, (m) => (m.startsWith("</") ? "</" : "<"));
}

/** Decodifica CDATA inline. */
export function unwrapCdata(xml: string): string {
  return xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner) => inner);
}

/** Decodifica entidades XML básicas (não recursivo, leve). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Pega o conteúdo (inner XML) de UMA tag específica. */
export function pickInner(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?=[\\s/>])[^>]*?(?:/>|>([\\s\\S]*?)</${tag}>)`, "i");
  const m = xml.match(re);
  if (!m) return undefined;
  return (m[1] ?? "").trim();
}

/** Pega texto puro (decodificado) de uma tag. */
export function pickText(xml: string, tag: string): string | undefined {
  const inner = pickInner(xml, tag);
  if (inner === undefined) return undefined;
  return decodeEntities(inner.trim());
}

/** Itera todos os blocos `<tag ...>...</tag>` de um XML, retornando inner+attrs. */
export function pickAllBlocks(
  xml: string,
  tag: string,
): Array<{ inner: string; attrs: Record<string, string> }> {
  const re = new RegExp(
    `<${tag}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`,
    "gi",
  );
  const out: Array<{ inner: string; attrs: Record<string, string> }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push({ inner: (m[2] ?? "").trim(), attrs: parseAttrs(m[1] ?? "") });
  }
  return out;
}

/** Atributos de uma tag de abertura. */
export function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Za-z_][\w.-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) out[m[1]] = m[2];
  return out;
}

function toInt(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function tipoValor(raw?: string): "alfanumerico" | "decimal" {
  return raw === "decimal" ? "decimal" : "alfanumerico";
}

// ---------------------------- parsers de blocos ---------------------------

function parseValorResultado(inner: string, attrs: Record<string, string>): ValorResultado {
  return {
    conteudo: decodeEntities(inner),
    nome: attrs.Nome,
    tipo: tipoValor(attrs.Tipo),
    casasDecimais: toInt(attrs.CasasDecimais) ?? 0,
    tamanhoMaximo: toInt(attrs.TamanhoMaximo),
    idValor: toInt(attrs.idValor),
  };
}

function parseLinha(inner: string, attrs: Record<string, string>): ValorReferenciaLinha {
  return {
    idLinha: toInt(attrs.idLinha),
    categoria1: pickText(inner, "Categoria1"),
    categoria2: pickText(inner, "Categoria2"),
    categoria3: pickText(inner, "Categoria3"),
    categoria4: pickText(inner, "Categoria4"),
    parametro1: pickText(inner, "Parametro1"),
    unidadeDoParametro1: pickText(inner, "UnidadeDoParametro1"),
    parametro2: pickText(inner, "Parametro2"),
    unidadeDoParametro2: pickText(inner, "UnidadeDoParametro2"),
    valor1: pickText(inner, "Valor1"),
    valor2: pickText(inner, "Valor2"),
    unidadeDoValor: pickText(inner, "UnidadeDoValor"),
  };
}

function parseValorDeReferencia(inner: string): ValorDeReferencia | undefined {
  // Tabela tem prioridade no choice; se ausente, tenta Valor texto livre.
  const tabelaInner = pickInner(inner, "Tabela");
  if (tabelaInner !== undefined) {
    const linhas = pickAllBlocks(tabelaInner, "Linha").map((b) =>
      parseLinha(b.inner, b.attrs),
    );
    return { tipo: "tabela", linhas };
  }
  const valorBlocks = pickAllBlocks(inner, "Valor");
  if (valorBlocks.length > 0) {
    const b = valorBlocks[0];
    return {
      tipo: "texto",
      conteudo: decodeEntities(b.inner),
      casasDecimais: toInt(b.attrs.CasasDecimais),
      tamanhoMaximo: toInt(b.attrs.TamanhoMaximo),
      tipoValor: b.attrs.Tipo ? tipoValor(b.attrs.Tipo) : undefined,
      idValor: toInt(b.attrs.idValor),
    };
  }
  return undefined;
}

function parseResultado(inner: string, attrs: Record<string, string>): ResultadoItem {
  const conteudoInner = pickInner(inner, "Conteudo") ?? "";
  const valores = pickAllBlocks(conteudoInner, "Valor").map((b) =>
    parseValorResultado(b.inner, b.attrs),
  );
  const vrInner = pickInner(inner, "ValorDeReferencia");
  return {
    idResultado: toInt(attrs.idResultado),
    nome: attrs.Nome,
    valores,
    unidadeDeMedida: pickText(inner, "UnidadeDeMedida"),
    valorDeReferencia: vrInner !== undefined ? parseValorDeReferencia(vrInner) : undefined,
  };
}

function parseInfAdicional(inner: string, attrs: Record<string, string>): InfAdicional {
  const valBlocks = pickAllBlocks(inner, "Valor");
  let valor: InfAdicionalValor | undefined;
  if (valBlocks.length > 0) {
    const b = valBlocks[0];
    valor = {
      conteudo: decodeEntities(b.inner),
      tipo: tipoValor(b.attrs.Tipo),
      casasDecimais: toInt(b.attrs.CasasDecimais) ?? 0,
      tamanhoMaximo: toInt(b.attrs.TamanhoMaximo),
      idValor: toInt(b.attrs.idValor),
    };
  }
  return {
    descricao: pickText(inner, "Descricao"),
    valor,
    idInfAdicional: toInt(attrs.idInfAdicional),
  };
}

function parseItemDeExame(inner: string, attrs: Record<string, string>): ItemDeExame {
  const resultados = pickAllBlocks(inner, "Resultado").map((b) =>
    parseResultado(b.inner, b.attrs),
  );
  return {
    idItemDeExame: toInt(attrs.idItemDeExame),
    nome: pickText(inner, "Nome") ?? "",
    metodo: pickText(inner, "Metodo"),
    interpretacao: pickText(inner, "Interpretacao"),
    comentarioPatologista: pickText(inner, "ComentarioDoPatologista"),
    nota: pickText(inner, "Nota"),
    unidade: pickText(inner, "Unidade"),
    condicaoDaAmostra: pickText(inner, "CondicaoDaAmostra"),
    estimulo: pickText(inner, "Estimulo"),
    resultados,
    observacao: pickText(inner, "Observacao"),
  };
}

function parseExame(inner: string, attrs: Record<string, string>): ExameResultado {
  const infAdicionais = pickAllBlocks(inner, "InfAdicional").map((b) =>
    parseInfAdicional(b.inner, b.attrs),
  );
  // ItemDeExame é nested dentro de Exame, mas Resultado.* também tem irmãos.
  // Pegamos apenas os ItemDeExame de primeiro nível dentro do Exame.
  const itensDeExame = pickAllBlocks(inner, "ItemDeExame").map((b) =>
    parseItemDeExame(b.inner, b.attrs),
  );
  return {
    idExame: toInt(attrs.idExame),
    infAdicionais,
    itensDeExame,
    observacao: pickText(inner, "Observacao"),
  };
}

function parseSuperExame(inner: string): SuperExameResultado {
  const exames = pickAllBlocks(inner, "Exame").map((b) => parseExame(b.inner, b.attrs));
  return {
    materialNome: pickText(inner, "MaterialNome") ?? "",
    exameNome: pickText(inner, "ExameNome") ?? "",
    codExmApoio: pickText(inner, "CodExmApoio") ?? "",
    codExmLab: pickText(inner, "CodExmLab"),
    codigoFormato: pickText(inner, "CodigoFormato") ?? "",
    retificacao: pickText(inner, "Retificacao"),
    exames,
  };
}

function parsePedido(inner: string): PedidoResultado {
  const superExames = pickAllBlocks(inner, "SuperExame").map((b) => parseSuperExame(b.inner));
  return {
    codPedApoio: pickText(inner, "CodPedApoio") ?? "",
    codPedLab: pickText(inner, "CodPedLab"),
    nomePaciente: pickText(inner, "Nome") ?? "",
    retificacao: pickText(inner, "Retificacao"),
    superExames,
  };
}

function parseControleDeLote(inner: string): ControleDeLote {
  const periodoInner = pickInner(inner, "Periodo");
  const periodo: PeriodoResultados | undefined = periodoInner
    ? {
        dataInicial: pickText(periodoInner, "DataInicial"),
        horaInicial: pickText(periodoInner, "HoraInicial"),
        dataFinal: pickText(periodoInner, "DataFinal"),
        horaFinal: pickText(periodoInner, "HoraFinal"),
      }
    : undefined;
  return {
    emissor: pickText(inner, "Emissor") ?? "",
    dataEmissao: pickText(inner, "DataEmissao"),
    horaEmissao: pickText(inner, "HoraEmissao"),
    periodo,
    codLab: pickText(inner, "CodLab") ?? "",
  };
}

// ---------------------------- entrada pública -----------------------------

function detectFault(xml: string): { code?: string; message?: string } | null {
  const fault = pickInner(xml, "Fault");
  if (!fault) return null;
  return {
    code: pickText(fault, "faultcode") ?? pickText(fault, "Code"),
    message: pickText(fault, "faultstring") ?? pickText(fault, "Reason"),
  };
}

/**
 * Extrai o XML `<Resultados>` de dentro de um envelope SOAP, suportando:
 *  - laudo direto (sem wrapper)
 *  - laudo dentro de `<resultadoXml><![CDATA[...]]></resultadoXml>`
 *  - laudo entity-escaped (`&lt;Resultados&gt;...&lt;/Resultados&gt;`)
 */
export function extractResultadosBlock(rawXml: string): string | undefined {
  return extractResultadosBlocks(rawXml)[0];
}

/**
 * Extrai TODOS os blocos `<Resultados>` presentes no envelope SOAP.
 *
 * Estratégias (cumulativas — todas são exploradas):
 *  1. Tags `<Resultados>` diretas (qualquer namespace).
 *  2. Wrappers `<resultadoXml>` / `<ResultadoXML>` / `<xmlResultado>` que
 *     embrulham um ou mais `<Resultados>` em CDATA ou entity-escaped.
 *  3. `<resultadosLote>` plural com vários filhos `<Resultados>`.
 *
 * Garante uma lista de blocos completos e auto-suficientes — cada um na forma
 * `<Resultados>...</Resultados>` — para serem parseados independentemente e
 * mesclados em um único `ResultadosLote` final (preserva todos os pedidos).
 */
export function extractResultadosBlocks(
  rawXml: string,
  debug?: ParseDebug,
): string[] {
  const dbg = debug ?? new ParseDebug();
  const out: string[] = [];
  // Para a varredura direta, ocultamos o conteúdo de CDATA — eles serão
  // re-explorados pelos wrappers em (2). Evita contar 2× o mesmo bloco.
  const noCdata = rawXml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const noNs = stripNs(noCdata);

  // 1) blocos <Resultados> diretos (fora de CDATA)
  const direct = pickAllBlocks(noNs, "Resultados");
  if (direct.length) {
    dbg.info(`extract: ${direct.length} bloco(s) <Resultados> direto(s)`);
    for (const b of direct) {
      if (/<\w/.test(b.inner)) out.push(`<Resultados>${b.inner}</Resultados>`);
    }
  }

  // 2) wrappers conhecidos contendo XML em CDATA / entity-escaped
  // Os matches são case-insensitive (regex `gi`), então basta uma forma por
  // grafia distinta — variações de caixa do mesmo nome contariam o bloco 2×.
  const wrapperTags = ["resultadoXml", "xmlResultado", "resultadoLote"];
  const fullNoNs = stripNs(rawXml);
  const seenWrapperRanges: Array<[number, number]> = [];
  for (const tag of wrapperTags) {
    const re = new RegExp(
      `<${tag}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`,
      "gi",
    );
    let m: RegExpExecArray | null;
    while ((m = re.exec(fullNoNs)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      // Se outro wrapper já cobriu este intervalo (mesma posição), pula.
      if (seenWrapperRanges.some(([s, e]) => s === start && e === end)) continue;
      seenWrapperRanges.push([start, end]);
      const w = { inner: (m[2] ?? "").trim() };
      const decoded = decodeEntities(unwrapCdata(w.inner));
      const norm = stripNs(decoded);
      const inners = pickAllBlocks(norm, "Resultados");
      if (inners.length) {
        dbg.info(`extract: wrapper <${tag}> contém ${inners.length} bloco(s)`);
        for (const inner of inners) {
          out.push(`<Resultados>${inner.inner}</Resultados>`);
        }
      } else if (/<Resultados/i.test(norm)) {
        dbg.warn(`extract: wrapper <${tag}> mencionou Resultados sem fechamento — ignorado`);
      }
    }
  }

  if (!out.length) {
    dbg.warn(
      "extract: nenhum <Resultados> encontrado",
      { wrappersTentados: wrapperTags, tamanhoXml: rawXml.length },
    );
  }
  return out;
}

export function parseResultadosLote(
  rawXml: string,
  debug?: ParseDebug,
): ParsedResponse<ResultadosLote> {
  const dbg = debug ?? new ParseDebug();
  const fault = detectFault(stripNs(rawXml));
  if (fault) {
    dbg.error("SOAP Fault detectado", fault);
    return {
      ok: false,
      raw: rawXml,
      faultCode: fault.code,
      faultString: fault.message,
      debug: dbg.events,
    };
  }

  const blocks = extractResultadosBlocks(rawXml, dbg);
  if (!blocks.length) {
    return {
      ok: false,
      raw: rawXml,
      faultCode: "PARSE_ERROR",
      faultString: "Bloco <Resultados> não encontrado no XML.",
      debug: dbg.events,
    };
  }

  // Mescla N blocos <Resultados> em um único lote — preserva TODOS os pedidos.
  // Cabeçalho (Protocolo/ID/ControleDeLote) vem do primeiro bloco; pedidos são
  // concatenados na ordem.
  let head: { protocolo: number; id: string; controle: ControleDeLote } | null = null;
  const pedidos: PedidoResultado[] = [];
  blocks.forEach((block, idx) => {
    const inner = pickInner(block, "Resultados") ?? "";
    const controleInner = pickInner(inner, "ControleDeLote") ?? "";
    const blockPedidos = pickAllBlocks(inner, "Pedido").map((b) => parsePedido(b.inner));
    dbg.info(`parse: bloco #${idx + 1} → ${blockPedidos.length} pedido(s)`);
    if (!head) {
      head = {
        protocolo: toInt(pickText(inner, "Protocolo")) ?? 0,
        id: pickText(inner, "ID") ?? "",
        controle: parseControleDeLote(controleInner),
      };
    }
    pedidos.push(...blockPedidos);
  });

  const lote: ResultadosLote = {
    protocolo: head!.protocolo,
    id: head!.id,
    controleDeLote: head!.controle,
    pedidos,
  };
  dbg.info(`parse: total ${pedidos.length} pedido(s) em ${blocks.length} bloco(s)`);

  return { ok: true, raw: rawXml, data: lote, debug: dbg.events };
}

// ---------------------- adapter para DTO legado ---------------------------

function renderRefHumano(vr?: ValorDeReferencia): string | undefined {
  if (!vr) return undefined;
  if (vr.tipo === "texto") return vr.conteudo || undefined;
  if (!vr.linhas.length) return undefined;
  return vr.linhas
    .map((l) => {
      const cat = [l.categoria1, l.categoria2, l.categoria3, l.categoria4]
        .filter(Boolean)
        .join(" / ");
      const range =
        l.valor1 && l.valor2
          ? `${l.valor1} - ${l.valor2}`
          : l.valor1
            ? `≥ ${l.valor1}`
            : l.valor2
              ? `≤ ${l.valor2}`
              : "";
      const unit = l.unidadeDoValor ? ` ${l.unidadeDoValor}` : "";
      return [cat, `${range}${unit}`.trim()].filter(Boolean).join(": ");
    })
    .join(" | ");
}

/**
 * Aplaina o ResultadosLote em uma lista plana de ResultadoExameDTO
 * (compatível com o DTO legado e o consumo em integration-poll-results).
 * Cria uma entrada por `Resultado` dentro de cada `ItemDeExame`.
 */
export function toLegacyExames(lote: ResultadosLote): ResultadoExameDTO[] {
  const out: ResultadoExameDTO[] = [];
  for (const pedido of lote.pedidos) {
    for (const sup of pedido.superExames) {
      for (const exame of sup.exames) {
        for (const item of exame.itensDeExame) {
          if (!item.resultados.length) {
            out.push({
              codigoApoio: sup.codExmApoio,
              nomeExame: `${sup.exameNome} – ${item.nome}`,
              status: "FINAL",
              metodo: item.metodo,
              material: sup.materialNome,
              observacao: item.observacao,
            });
            continue;
          }
          for (const res of item.resultados) {
            const valor = res.valores[0]?.conteudo;
            const vr = res.valorDeReferencia;
            out.push({
              codigoApoio: sup.codExmApoio,
              nomeExame: res.nome
                ? `${sup.exameNome} – ${item.nome} – ${res.nome}`
                : `${sup.exameNome} – ${item.nome}`,
              status: "FINAL",
              valor,
              unidade: res.unidadeDeMedida ?? item.unidade,
              referencia: renderRefHumano(vr),
              referenciaLinhas: vr?.tipo === "tabela" ? vr.linhas : undefined,
              referenciaTexto: vr?.tipo === "texto" ? vr.conteudo : undefined,
              metodo: item.metodo,
              material: sup.materialNome,
              observacao: item.observacao,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Converte ResultadosLote → GetResultadoOutput legado (status FINAL,
 * datas derivadas do ControleDeLote, paciente do primeiro pedido).
 */
export function toLegacyGetResultadoOutput(lote: ResultadosLote): GetResultadoOutput {
  const firstPedido = lote.pedidos[0];
  const dataLib = lote.controleDeLote.dataEmissao
    ? `${lote.controleDeLote.dataEmissao}${
        lote.controleDeLote.horaEmissao ? `T${lote.controleDeLote.horaEmissao}` : ""
      }`
    : undefined;
  return {
    externalProtocol: firstPedido?.codPedApoio ?? "",
    pacienteNome: firstPedido?.nomePaciente,
    dataLiberacao: dataLib,
    status: "FINAL",
    exames: toLegacyExames(lote),
  };
}