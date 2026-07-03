// Sidebar de exames (desktop split view) da tela de Resultado.
// Extraído mecanicamente de ResultadoDetalhe.tsx (Onda 2) — comportamento,
// classes utilitárias e ordem de renderização preservados 1:1.
import { Search, ChevronRight, Printer, AlertCircle } from "lucide-react";
import StatusBadge from "@/components/StatusBadge";
import LabBadge from "@/components/LabBadge";
import IntegrationStatusBadge from "@/components/IntegrationStatusBadge";
import type { AtendimentoExameRow } from "@/data/atendimentoStore";
import { statusExameMap, type DbIdMap, type Exame } from "../types";

export type StatusFilterKey = "todos" | "pendentes" | "salvos" | "liberados" | "cancelados";

export interface ExameCounters {
  total: number;
  pendentes: number;
  salvos: number;
  liberados: number;
  cancelados: number;
}

export interface ExameSidebarProps {
  counters: ExameCounters;
  concluidos: number;
  progresso: number;
  goToNextPendente: () => void;

  searchQuery: string;
  setSearchQuery: (v: string) => void;

  statusFilter: StatusFilterKey;
  setStatusFilter: (v: StatusFilterKey) => void;

  filteredExames: Exame[];
  isHydrating: boolean;

  selectedExameId: number;
  setSelectedExameId: (id: number) => void;

  dbIdMap: DbIdMap;
  dbRows: AtendimentoExameRow[];
  retificados: Set<number>;

  isExameLiberado: (status: Exame["status"]) => boolean;
  isExameTerceirizadaById: (id: number) => boolean;
  getLabNome: (id: number) => string | null;
  getMnemonico: (nome: string) => string;

  onImprimirExame: (exames: Exame[]) => void;
}

export function ExameSidebar({
  counters,
  concluidos,
  progresso,
  goToNextPendente,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  filteredExames,
  isHydrating,
  selectedExameId,
  setSelectedExameId,
  dbIdMap,
  dbRows,
  retificados,
  isExameLiberado,
  isExameTerceirizadaById,
  getLabNome,
  getMnemonico,
  onImprimirExame,
}: ExameSidebarProps) {
  return (
    <div className="w-60 shrink-0 border-r border-border/60 flex flex-col max-h-[calc(100vh-140px)] bg-muted/10">
      {/* Sidebar header: progress + counters (compact) */}
      <div className="px-3 py-3 border-b border-border/60">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Progresso</span>
          <span className="text-[11px] font-semibold tabular-nums text-foreground">{concluidos}/{counters.total} · {progresso}%</span>
        </div>
        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
        </div>
        {counters.pendentes > 0 && (
          <button
            onClick={goToNextPendente}
            className="mt-2.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
          >
            Próximo pendente
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="px-3 pt-3 pb-1">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar exame"
            className="pl-8 pr-2.5 h-9 w-full bg-card border border-border/60 rounded-lg text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>

        {/* Status filter chips — uma linha; oculta zerados */}
        <div className="flex gap-1 mb-1 w-full">
          {([
            { key: "todos", label: "Todos", count: counters.total },
            { key: "pendentes", label: "Pend.", count: counters.pendentes },
            { key: "salvos", label: "Salv.", count: counters.salvos },
            { key: "liberados", label: "Liber.", count: counters.liberados },
            { key: "cancelados", label: "Canc.", count: counters.cancelados },
          ] as const)
            .filter((f) => f.key === "todos" || f.count > 0 || statusFilter === f.key)
            .map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`flex-1 min-w-0 px-1 py-1 rounded-md text-[9px] font-semibold uppercase tracking-tight transition-colors whitespace-nowrap ${
                  statusFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-accent"
                }`}
              >
                {f.label} <span className="opacity-70">{f.count}</span>
              </button>
            ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
        {filteredExames.length === 0 && (
          isHydrating ? (
            <div className="space-y-1.5 py-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground py-8">Nenhum exame nesse filtro.</p>
          )
        )}
        {filteredExames.map((exame) => {
          const liberado = isExameLiberado(exame.status);
          const isSelected = selectedExameId === exame.id;
          const dbId = dbIdMap[exame.id];
          const dbRow = dbRows.find((r) => r.id === dbId);
          const isTerc = isExameTerceirizadaById(exame.id);
          return (
            <div
              key={exame.id}
              className={`rounded-lg border transition-colors ${
                isSelected ? "bg-card border-primary/40 shadow-[0_1px_2px_rgba(77,65,243,0.08)]" : "border-transparent hover:bg-accent/50"
              }`}
            >
              <button
                onClick={() => setSelectedExameId(exame.id)}
                className="w-full text-left px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold tracking-[0.08em] text-primary uppercase font-mono truncate">
                    {getMnemonico(exame.nome)}
                  </span>
                  {isTerc ? (
                    <LabBadge
                      tipoProcesso="TERCEIRIZADO"
                      labApoioId={dbRow?.lab_apoio_id ?? null}
                      labApoioNome={getLabNome(exame.id) || undefined}
                      compact
                    />
                  ) : (
                    <StatusBadge label={exame.status} type={statusExameMap[exame.status].type} />
                  )}
                </div>

                {isTerc && dbRow && dbRow.status_externo !== "NAO_APLICAVEL" && (
                  <div className="mt-1.5">
                    <IntegrationStatusBadge row={dbRow} compact />
                  </div>
                )}

                {retificados.has(exame.id) && exame.status !== "Em retificação" && exame.status !== "Retificado" && (() => {
                  const dbRow2 = dbRows.find((r) => r.id === dbIdMap[exame.id]);
                  const emCurso = dbRow2 ? dbRow2.status !== "finalizado" && dbRow2.status !== "cancelado" : false;
                  return (
                    <div className={`flex items-center gap-1 mt-1.5 ${emCurso ? "text-status-warning" : "text-status-info"}`}>
                      <AlertCircle className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{emCurso ? "Em retificação" : "Retificado"}</span>
                    </div>
                  );
                })()}
              </button>
              {isSelected && liberado && !isTerc && (
                <div className="px-3 pb-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onImprimirExame([exame]); }}
                    className="w-full flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    title="Imprimir este exame"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Imprimir exame
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ExameSidebar;
