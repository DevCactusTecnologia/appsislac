// Fase 4 — Impressão em lote por laboratório de apoio.
// Componente puramente apresentacional: recebe a lista de exames coletados (com lab apoio resolvido),
// agrupa por destino e expõe um botão por lab + um botão geral.
//
// REGRA: aditivo. Não substitui o botão por exame; apenas oferece um atalho rápido.

import { useMemo, useState } from "react";
import { Printer, Building2, FlaskConical, AlertTriangle, Check, RotateCcw, FileText } from "lucide-react";
import { imprimirEtiquetaPorAtendimentoExame } from "@/lib/imprimirEtiquetaPorAtendimentoExame";
import { getLabsApoio } from "@/data/labApoioStore";
import { siglaLab, corLab } from "@/lib/labApoio";
import { toast } from "sonner";
import { showError } from "@/lib/showError";

export interface ImpressaoLoteExame {
  /** ID da linha em atendimento_exames (passado para a função de impressão). */
  atendimentoExameId: number;
  /** Identidade visual do destino. */
  tipoProcesso?: "INTERNO" | "TERCEIRIZADO" | string | null;
  labApoioId?: string | null;
  /** Mostrar apenas exames com amostra criada (já coletada). */
  amostraId?: string | null;
  /** Nome do exame — usado em mensagens de validação. */
  nomeExame?: string | null;
}

interface Props {
  exames: ImpressaoLoteExame[];
  /** Nome do laboratório próprio (tenant) para badge INTERNO. */
  laboratorioPropriaNome?: string | null;
  /** Layout compacto (sem título). */
  compact?: boolean;
  className?: string;
  /**
   * Quando true, permite impressão mesmo sem `amostraId`:
   * etiquetas funcionam como guia de remessa para o laboratório de apoio.
   */
  permitirGuiaRemessa?: boolean;
}

const ImpressaoLotePorLab = ({
  exames,
  laboratorioPropriaNome,
  compact = false,
  className = "",
  permitirGuiaRemessa = false,
}: Props) => {
  const [printing, setPrinting] = useState(false);
  // Estado local por sessão: ids de exames já enviados para impressão neste lote.
  const [impressos, setImpressos] = useState<Set<number>>(new Set());
  const labs = getLabsApoio();

  // 1) Pré-validação: exames sem destino definido (sem tipoProcesso ou TERCEIRIZADO sem labApoioId).
  const pendentesSemDestino = useMemo(() => {
    return exames.filter((e) => {
      if (!e.amostraId && !permitirGuiaRemessa) return false; // não entram no lote
      const tipo = (e.tipoProcesso ?? "").toString().trim().toUpperCase();
      if (tipo !== "INTERNO" && tipo !== "TERCEIRIZADO") return true;
      if (tipo === "TERCEIRIZADO" && !e.labApoioId) return true;
      return false;
    });
  }, [exames, permitirGuiaRemessa]);

  // 2) Agrupa por chave de destino (lab id ou "INTERNO").
  const grupos = useMemo(() => {
    const map = new Map<string, {
      key: string;
      label: string;
      sigla: string;
      cor: ReturnType<typeof corLab>;
      tipo: "INTERNO" | "TERCEIRIZADO";
      ids: number[];
      semAmostra: number; // quantos sem amostra real (guia de remessa)
    }>();
    for (const e of exames) {
      const tipoRaw = (e.tipoProcesso ?? "").toString().trim().toUpperCase();
      // Exames sem destino válido NÃO entram em nenhum grupo (caem na validação).
      if (tipoRaw !== "INTERNO" && tipoRaw !== "TERCEIRIZADO") continue;
      if (tipoRaw === "TERCEIRIZADO" && !e.labApoioId) continue;
      // Sem amostra: só entra se o modo guia de remessa estiver permitido.
      if (!e.amostraId && !permitirGuiaRemessa) continue;
      const tipo: "INTERNO" | "TERCEIRIZADO" = tipoRaw as "INTERNO" | "TERCEIRIZADO";
      let key: string;
      let label: string;
      let cor: ReturnType<typeof corLab>;
      let sigla: string;
      if (tipo === "TERCEIRIZADO") {
        const lab = labs.find((l) => l.id === e.labApoioId);
        const nome = lab?.nome ?? "Lab apoio";
        key = `EXT:${e.labApoioId}`;
        label = nome;
        sigla = siglaLab(nome);
        cor = corLab(e.labApoioId ?? nome);
      } else {
        const nome = laboratorioPropriaNome?.trim() || "INTERNO";
        key = "INT";
        label = nome;
        sigla = siglaLab(nome);
        cor = corLab(`internal:${nome}`);
      }
      const bucket = map.get(key) ?? { key, label, sigla, cor, tipo, ids: [], semAmostra: 0 };
      bucket.ids.push(e.atendimentoExameId);
      if (!e.amostraId) bucket.semAmostra += 1;
      map.set(key, bucket);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.tipo !== b.tipo) return a.tipo === "INTERNO" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
  }, [exames, labs, laboratorioPropriaNome, permitirGuiaRemessa]);

  if (grupos.length === 0 && pendentesSemDestino.length === 0) return null;

  const imprimirGrupo = async (ids: number[], label: string) => {
    if (printing) return;
    if (pendentesSemDestino.length > 0) {
      // Bloqueia: força configurar destino antes.
      const nomes = pendentesSemDestino
        .map((e) => e.nomeExame ?? `#${e.atendimentoExameId}`)
        .slice(0, 6)
        .join(", ");
      const extra =
        pendentesSemDestino.length > 6 ? ` e +${pendentesSemDestino.length - 6}` : "";
      toast.error("Há exames sem destino definido", {
        description: `Configure o laboratório de apoio antes de imprimir: ${nomes}${extra}.`,
      });
      return;
    }
    // Filtra somente os ainda não impressos nesta sessão.
    const restantes = ids.filter((id) => !impressos.has(id));
    if (restantes.length === 0) return;
    setPrinting(true);
    try {
      for (const id of restantes) {
        await imprimirEtiquetaPorAtendimentoExame(id);
      }
      setImpressos((prev) => {
        const next = new Set(prev);
        for (const id of restantes) next.add(id);
        return next;
      });
      toast.success(
        `Etiquetas de ${label} enviadas para impressão (${restantes.length})`,
      );
    } catch (err) {
      showError(err, { scope: "ImpressaoLotePorLab", userMessage: "Falha ao imprimir etiquetas em lote" });
    } finally {
      setPrinting(false);
    }
  };

  const resetGrupo = (ids: number[]) => {
    setImpressos((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  return (
    <div
      className={`rounded-xl border border-border/60 bg-card/40 ${compact ? "p-3" : "p-4"} ${className}`}
    >
      {!compact && (
        <div className="flex items-center gap-2 mb-3">
          <Printer className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Imprimir etiquetas por laboratório
          </p>
        </div>
      )}

      {pendentesSemDestino.length > 0 && (
        <div
          className="mb-2 flex items-start gap-2 rounded-lg border border-status-warning/40 bg-status-warning/10 px-3 py-2"
          role="alert"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-status-warning mt-0.5 shrink-0" />
          <div className="text-[11px] text-status-warning leading-snug">
            <strong className="font-semibold">{pendentesSemDestino.length}</strong>{" "}
            exame(s) sem destino definido — impressão bloqueada até configurar o laboratório.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {grupos.map((g) => {
          const Icon = g.tipo === "INTERNO" ? FlaskConical : Building2;
          const totalImpressos = g.ids.filter((id) => impressos.has(id)).length;
          const tudoImpresso = totalImpressos === g.ids.length;
          const restantes = g.ids.length - totalImpressos;
          return (
            <div key={g.key} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => imprimirGrupo(g.ids, g.label)}
                disabled={printing || tudoImpresso || pendentesSemDestino.length > 0}
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={
                  tudoImpresso
                    ? `Todas as ${g.ids.length} etiqueta(s) de ${g.label} já foram impressas neste lote`
                    : `Imprimir ${restantes} etiqueta(s) — ${g.label}${
                        g.semAmostra > 0 ? ` (inclui ${g.semAmostra} guia(s) de remessa)` : ""
                      }`
                }
              >
                <span
                  className="inline-flex items-center gap-1 rounded-md text-[10px] font-bold px-1.5 py-0.5"
                  style={{ backgroundColor: g.cor.bg, color: g.cor.fg }}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {g.sigla}
                </span>
                <span className="truncate max-w-[140px]">{g.label}</span>
                <span className="h-4 min-w-4 px-1 rounded-full bg-foreground/10 text-foreground text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {tudoImpresso ? g.ids.length : `${totalImpressos}/${g.ids.length}`}
                </span>
                {g.semAmostra > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground"
                    title={`${g.semAmostra} guia(s) de remessa (sem amostra física)`}
                  >
                    <FileText className="h-2.5 w-2.5" />
                  </span>
                )}
                {tudoImpresso ? (
                  <Check className="h-3 w-3 text-status-success" />
                ) : (
                  <Printer className="h-3 w-3 text-muted-foreground" />
                )}
              </button>
              {tudoImpresso && (
                <button
                  type="button"
                  onClick={() => resetGrupo(g.ids)}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
                  title="Reimprimir este grupo (limpa marcação local)"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImpressaoLotePorLab;
