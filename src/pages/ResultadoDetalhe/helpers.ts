// Helpers puros extraídos de ResultadoDetalhe.tsx (Fase 3 — slicing estrutural).
// Sem estado de componente, sem hooks. Comportamento preservado literalmente.
import { formatIdadeDetalhada } from "@/lib/idade";
import { getAtendimentos, type AtendimentoExameRow } from "@/data/atendimentoStore";
import type { MockAtendimento } from "@/data/types";
import type { DigitacaoSegmento } from "@/lib/layoutScientificRuntime";
import type { DbIdMap, Exame, ExameStatus, Paciente, Parametro } from "./types";

/**
 * Templates legados de parâmetros por protocolo.
 * Hoje os parâmetros são derivados das rows de `atendimento_exames.resultados`
 * + fallback genérico em `buildExamesFromDB`. Mantido vazio.
 */
export const templatesParametrosLegado: Record<
  string,
  {
    id: number;
    nome: string;
    sexo: string;
    nascimento: string;
    idade: string;
    protocolo: string;
    dataCadastro: string;
    statusGeral: string;
    exames: { id: number; nome: string; material: string; status: string; dataAnalise: string; parametros: Parametro[] }[];
  }
> = {};

export const isoToBR = (s: string): string => {
  if (!s) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

export const calcIdadeAnosMeses = (nascimento: string): string => formatIdadeDetalhada(isoToBR(nascimento));

// Status do banco → status da UI.
export const STATUS_DB_TO_UI: Record<AtendimentoExameRow["status"], ExameStatus> = {
  pendente: "Pendente",
  coletado: "Pendente",
  em_bancada: "Pendente",
  analisado: "Pendente",
  em_analise: "Resultado salvo",
  finalizado: "Digitado",
  cancelado: "Cancelado",
};

export function statusDbToUi(row: AtendimentoExameRow): ExameStatus {
  if (row.retificado) {
    if (row.status === "finalizado") return "Retificado";
    if (row.status !== "cancelado") return "Em retificação";
  }
  return STATUS_DB_TO_UI[row.status];
}

export const getEmptyPaciente = (): Paciente => ({
  id: 0, nome: "", cpf: "", sexo: "", nascimento: "", idade: "",
  protocolo: "", dataCadastro: "", statusGeral: "", exames: [],
});

/**
 * Constrói os exames da UI a partir das rows do banco.
 *
 * **Pipeline oficial (LayoutScientificRuntime):**
 *   row → parametros do layout padrão → dual-read dos resultados → inputs tipados.
 *
 * Quando o runtime ainda não resolveu (ex.: catálogo sem id), cai em um
 * fallback degenerado de UM input genérico (mesmo comportamento legacy),
 * preservando retro-compat de telas em que o exame não tem catálogo.
 */
export function buildExamesFromDB(
  rows: AtendimentoExameRow[],
  segmentosPorRowId: Record<number, DigitacaoSegmento[]>,
): { exames: Exame[]; idMap: DbIdMap } {
  const idMap: DbIdMap = {};
  const exames: Exame[] = rows.map((row, idx) => {
    const segs = segmentosPorRowId[row.id];
    let parametros: Parametro[];
    if (segs && segs.length > 0) {
      parametros = [];
      let pendingHeader: string | undefined;
      for (const seg of segs) {
        if (seg.kind === "header") {
          pendingHeader = seg.text;
          continue;
        }
        const { parametro, valor } = seg;
        parametros.push({
          nome: parametro.rotulo || parametro.chave || row.nome_exame,
          obrigatorio: !!parametro.obrigatorio,
          unidade: "",
          refMin: "",
          refMax: "",
          refUnidade: "",
          valor,
          chave: parametro.chave,
          rotulo: parametro.rotulo,
          tipo: parametro.tipo,
          opcoesSelect: parametro.opcoesSelect,
          casasDecimais: parametro.casasDecimais,
          criticoMin: parametro.criticoMin,
          criticoMax: parametro.criticoMax,
          parametroId: parametro.id,
          valorReferencia: parametro.valorReferencia,
          headerAntes: pendingHeader,
        });
        pendingHeader = undefined;
      }
    } else {
      parametros = [
          {
            nome: row.nome_exame,
            obrigatorio: true,
            unidade: "",
            refMin: "",
            refMax: "",
            refUnidade: "",
            valor: typeof (row.resultados as Record<string, string> | null)?.[row.nome_exame] === "string"
              ? ((row.resultados as Record<string, string>)[row.nome_exame] as string)
              : "",
          },
        ];
    }
    const uiId = idx + 1;
    idMap[uiId] = row.id;
    return {
      id: uiId,
      nome: row.nome_exame,
      material: row.material || "Sangue",
      status: statusDbToUi(row),
      dataAnalise: row.data_analise
        ? new Date(row.data_analise).toLocaleDateString("pt-BR")
        : "",
      dataColetaISO: row.data_coleta,
      dataAnaliseISO: row.data_analise,
      dataLiberacaoISO: row.data_liberacao,
      solicitante: row.solicitante ?? "",
      parametros,
      metodologiaSnapshot: row.metodologia_snapshot ?? null,
      unidadeSnapshot: row.unidade_snapshot ?? null,
    };
  });
  return { exames, idMap };
}

export function deriveStatusGeral(exames: Exame[], fallback: string): string {
  if (exames.length === 0) return fallback || "Pendente";
  if (exames.some((e) => e.status === "Em retificação")) return "Em Retificação";
  const allCanceled = exames.every((e) => e.status === "Cancelado");
  const allDone = exames.every((e) => e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado" || e.status === "Cancelado");
  const hasRetificado = exames.some((e) => e.status === "Retificado");
  const hasAtLeastOneLiberated = exames.some((e) => e.status === "Digitado" || e.status === "Impresso" || e.status === "Retificado");
  if (allCanceled) return "Cancelado";
  if (allDone && hasRetificado) return "Retificado";
  if (allDone && hasAtLeastOneLiberated) return "Finalizado";
  return "Pendente";
}

export function buildPacienteFromAtendimento(
  protocolo: string,
  exames: Exame[],
  atOverride?: MockAtendimento | null,
): Paciente {
  const at = atOverride ?? getAtendimentos().find((a) => a.protocolo === protocolo);
  const tpl = templatesParametrosLegado[protocolo];
  const fallbackStatus = at?.statusAtendimento.label ?? tpl?.statusGeral ?? "Pendente";
  return {
    id: tpl?.id ?? 0,
    nome: at?.nome ?? tpl?.nome ?? "",
    cpf: at?.cpf ?? "",
    sexo: tpl?.sexo ?? "Masculino",
    nascimento: at?.nascimento ?? tpl?.nascimento ?? "",
    idade: at?.idade ?? tpl?.idade ?? "",
    protocolo,
    dataCadastro: at?.data?.split(" ")[0] ?? tpl?.dataCadastro ?? "",
    statusGeral: deriveStatusGeral(exames, fallbackStatus),
    exames,
    convenio: at?.convenio ?? "",
    solicitante: at?.solicitante ?? "",
  };
}
