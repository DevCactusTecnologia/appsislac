import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RotateCcw, AlertTriangle, Check, ChevronsUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { useDicionario } from "@/hooks/useDicionario";
import { criarRecoleta, type RecoletaEtapa } from "@/data/recoletasStore";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface SolicitarRecoletaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  etapa: RecoletaEtapa;
  atendimentoId: number;
  atendimentoExameId: number;
  exameNome: string;
  pacienteNome: string;
  protocolo: string;
  /** Callback executado APÓS persistência bem-sucedida da recoleta. Use para
   *  marcar o exame como "pendente" novamente, etc. */
  onConfirmed?: () => void | Promise<void>;
}

const ETAPA_LABEL: Record<RecoletaEtapa, string> = {
  coleta: "Coleta",
  triagem: "Triagem",
  analise: "Análise",
  liberacao: "Liberação",
};

export default function SolicitarRecoletaDialog({
  open,
  onOpenChange,
  etapa,
  atendimentoId,
  atendimentoExameId,
  exameNome,
  pacienteNome,
  protocolo,
  onConfirmed,
}: SolicitarRecoletaDialogProps) {
  const { user } = useAuth();
  const [motivoId, setMotivoId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [motivoOpen, setMotivoOpen] = useState(false);

  const { data: motivos = [] } = useDicionario("recoleta_motivo", { ativosOnly: true });
  const motivoSelecionado = useMemo(
    () => motivos.find((m) => m.id === motivoId) ?? null,
    [motivos, motivoId],
  );

  useEffect(() => {
    if (open) { setMotivoId(""); setObservacao(""); }
  }, [open]);

  const handleConfirm = async () => {
    if (!motivoId) {
      toast.error("Selecione um motivo");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (!motivo) return;
    if (!motivo.legacyId) {
      toast.error("Motivo sem mapeamento legado — contate o administrador");
      return;
    }
    setSalvando(true);
    try {
      const novo = await criarRecoleta({
        atendimentoId,
        atendimentoExameId,
        exameNome,
        pacienteNome,
        protocolo,
        motivoId: motivo.legacyId,
        motivoNome: motivo.label,
        etapa,
        observacao: observacao.trim(),
        solicitanteEmail: user?.email ?? "",
      });
      if (!novo) {
        toast.error("Não foi possível registrar a recoleta");
        return;
      }
      toast.success("Recoleta registrada", {
        description: `${exameNome} — ${motivo.label}`,
      });
      onOpenChange(false);
      if (onConfirmed) await onConfirmed();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!salvando) onOpenChange(v); }}>
      <DialogContent className="max-w-lg rounded-3xl border-border/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-warning/10">
              <RotateCcw className="h-5 w-5 text-warning" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">
                Solicitar recoleta
              </DialogTitle>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Etapa: {ETAPA_LABEL[etapa]}
              </span>
            </div>
          </div>
          <DialogDescription className="text-sm text-muted-foreground mb-4">
            Registre o motivo da recoleta para análise gerencial. O exame
            <span className="font-semibold text-foreground"> {exameNome} </span>
            será marcado para nova coleta sem cobrança adicional.
          </DialogDescription>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                Motivo <span className="text-destructive">*</span>
              </label>
              {motivos.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-warning/5 border border-warning/20 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  Nenhum motivo cadastrado. Contate o administrador.
                </div>
              ) : (
                <select
                  value={motivoId}
                  onChange={(e) => setMotivoId(e.target.value)}
                  className="h-11 w-full px-3 rounded-2xl border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Selecione...</option>
                  {motivos.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">
                Observação <span className="text-muted-foreground/60 font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                placeholder="Detalhes adicionais sobre o ocorrido..."
                className="w-full px-3 py-2 rounded-2xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">
              Solicitante: <span className="font-medium text-foreground">{user?.email ?? "—"}</span> · Protocolo: <span className="font-medium text-foreground">{protocolo}</span>
            </div>
          </div>
        </div>
        <div className="h-px bg-border/50" />
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={salvando || !motivoId || motivos.length === 0}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {salvando ? "Registrando..." : "Registrar recoleta"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
