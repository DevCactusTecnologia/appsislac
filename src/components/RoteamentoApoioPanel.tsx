// Painel "Roteamento de apoio" — Fase 3 (Multi-lab)
// Permite que o operador altere, no momento do atendimento, o laboratório
// de apoio para cada exame TERCEIRIZADO. O valor padrão vem do catálogo;
// o override é apenas para este atendimento.
//
// REGRA: aditivo. Não altera nada se nenhum exame for terceirizado.

import { useMemo } from "react";
import { Building2, AlertTriangle } from "lucide-react";
import { getLabsApoioAtivos } from "@/data/labApoioStore";
import LabBadge from "@/components/LabBadge";

export interface RoteamentoExame {
  /** ID local da linha (chave React). */
  id: number;
  nome: string;
  /** "INTERNO" | "TERCEIRIZADO" — vindo do catálogo. */
  tipoProcesso?: "INTERNO" | "TERCEIRIZADO" | string | null;
  /** Lab apoio padrão (do catálogo). */
  labApoioIdPadrao?: string | null;
  /** Override escolhido neste atendimento (sobrescreve o padrão). */
  labApoioIdOverride?: string | null;
  /** Agrupamento lógico — usado para detectar conflito 1 amostra = 1 lab. */
  grupoExameId?: string | null;
}

interface Props {
  exames: RoteamentoExame[];
  onChange: (id: number, labApoioId: string | null) => void;
}

const RoteamentoApoioPanel = ({ exames, onChange }: Props) => {
  const labs = getLabsApoioAtivos();
  const terceirizados = useMemo(
    () => exames.filter(e => (e.tipoProcesso ?? "INTERNO") === "TERCEIRIZADO"),
    [exames],
  );

  // Detecta conflito: mesmo grupoExameId com labs diferentes (sistema vai quebrar em tubos separados — só avisa).
  const conflitos = useMemo(() => {
    const porGrupo = new Map<string, Set<string>>();
    for (const ex of terceirizados) {
      const grupo = ex.grupoExameId ?? `solo:${ex.id}`;
      const lab = ex.labApoioIdOverride ?? ex.labApoioIdPadrao ?? "—";
      const set = porGrupo.get(grupo) ?? new Set<string>();
      set.add(lab);
      porGrupo.set(grupo, set);
    }
    const grupos = new Set<string>();
    porGrupo.forEach((labsSet, grupo) => { if (labsSet.size > 1) grupos.add(grupo); });
    return grupos;
  }, [terceirizados]);

  if (terceirizados.length === 0) return null;

  return (
    <div className="border border-border/60 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-xl bg-primary/10 shrink-0">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground">Roteamento de apoio</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Defina o laboratório de destino dos exames terceirizados. O sistema garante 1 amostra = 1 laboratório.
          </p>
        </div>
      </div>

      {conflitos.size > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-[hsl(var(--status-warning))]/30 bg-[hsl(var(--status-warning-bg))] px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-warning))] mt-0.5 shrink-0" />
          <p className="text-[11px] text-foreground/90">
            Exames do mesmo grupo apontam para laboratórios diferentes — o sistema gerará tubos separados automaticamente.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {terceirizados.map((ex) => {
          const efetivo = ex.labApoioIdOverride ?? ex.labApoioIdPadrao ?? null;
          const labEfetivo = labs.find(l => l.id === efetivo);
          const isOverride = ex.labApoioIdOverride !== undefined && ex.labApoioIdOverride !== null
            && ex.labApoioIdOverride !== ex.labApoioIdPadrao;
          return (
            <div
              key={ex.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2 hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{ex.nome}</span>
                  <LabBadge
                    tipoProcesso="TERCEIRIZADO"
                    labApoioId={efetivo}
                    labApoioNome={labEfetivo?.nome}
                    compact
                  />
                  {isOverride && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded px-1.5 py-0.5">
                      Override
                    </span>
                  )}
                </div>
              </div>
              <select
                value={efetivo ?? ""}
                onChange={(e) => onChange(ex.id, e.target.value || null)}
                className="text-xs font-medium bg-background border border-border/60 rounded-lg px-2 py-1.5 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                title="Laboratório de destino"
              >
                <option value="">— Selecionar lab —</option>
                {labs.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nome}{l.id === ex.labApoioIdPadrao ? " (padrão)" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RoteamentoApoioPanel;
