import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Printer, User, ClipboardList, FlaskConical, FileText, AlertTriangle, ArrowUpDown, Clock, ChevronRight, ArrowLeft, Microscope, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AuditoriaEntry {
  acao: string;
  dataHora: string;
  usuario: string;
  iniciais: string;
  dados?: string;
}

interface AmostraAuditoria {
  nome: string;
  registros: AuditoriaEntry[];
}

interface AuditoriaPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pacienteNome: string;
  sexo: string;
  nascimento: string;
  idade: string;
  protocolo: string;
  amostras: AmostraAuditoria[];
}

const acaoConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  "Pedido realizado": { icon: User, color: "text-primary", bg: "bg-primary/10", label: "Atendimento" },
  "Novo atendimento criado": { icon: User, color: "text-primary", bg: "bg-primary/10", label: "Atendimento" },
  "Amostra coletada": { icon: ClipboardList, color: "text-[hsl(var(--status-success))]", bg: "bg-status-success-bg", label: "Coleta" },
  "Bancada iniciada": { icon: Microscope, color: "text-[hsl(var(--status-warning))]", bg: "bg-status-warning-bg", label: "Análise" },
  "Análise concluída": { icon: CheckCircle2, color: "text-[hsl(var(--status-teal))]", bg: "bg-status-teal-bg", label: "Análise" },
  "Resultado salvo": { icon: FlaskConical, color: "text-[hsl(var(--status-info))]", bg: "bg-status-info-bg", label: "Análise" },
  "Resultado liberado": { icon: FileText, color: "text-[hsl(var(--status-success))]", bg: "bg-status-success-bg", label: "Resultado" },
  "Resultado Liberado": { icon: FileText, color: "text-[hsl(var(--status-success))]", bg: "bg-status-success-bg", label: "Resultado" },
  "Resultado impresso": { icon: Printer, color: "text-[hsl(var(--status-purple))]", bg: "bg-status-purple-bg", label: "Impressão" },
  "Análise cancelada": { icon: AlertTriangle, color: "text-[hsl(var(--status-danger))]", bg: "bg-status-danger-bg", label: "Cancelamento" },
  "Resultado retificado": { icon: ArrowUpDown, color: "text-[hsl(var(--status-warning))]", bg: "bg-status-warning-bg", label: "Alteração" },
};

const defaultCfg = { icon: Clock, color: "text-muted-foreground", bg: "bg-muted", label: "Ação" };

const avatarColors: Record<string, string> = {
  FA: "bg-primary/10 text-primary",
  CS: "bg-status-success-bg text-[hsl(var(--status-success))]",
  ML: "bg-status-warning-bg text-[hsl(var(--status-warning))]",
};

const AuditoriaPanel = ({
  open,
  onOpenChange,
  pacienteNome,
  sexo,
  nascimento,
  idade,
  protocolo,
  amostras,
}: AuditoriaPanelProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const selectedAmostra = selectedIndex !== null ? amostras[selectedIndex] : null;

  const handleClose = (value: boolean) => {
    if (!value) setSelectedIndex(null);
    onOpenChange(value);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="sm:max-w-xl w-full p-0 overflow-hidden flex flex-col"
      >
        <SheetTitle className="sr-only">Rastreabilidade de Amostra</SheetTitle>

        {/* Header */}
        <div
          className="px-5 py-5 border-b"
          
        >
          <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase mb-1">
            {selectedAmostra ? "Linha do Tempo" : "Auditoria"}
          </p>
          <h2 className="text-lg font-bold text-foreground">{pacienteNome}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sexo}&nbsp;&nbsp;&nbsp;{nascimento} – {idade}
          </p>
          <span className="text-sm font-bold text-foreground font-mono mt-1 inline-block">{protocolo}</span>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {selectedAmostra === null ? (
            /* Exam list */
            <div className="p-4 sm:p-5 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Selecione um exame ({amostras.length})
              </p>
              {amostras.map((amostra, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedIndex(idx)}
                  className="w-full flex items-center justify-between gap-3 p-3.5 bg-card border border-border rounded-xl hover:shadow-sm hover:border-primary/20 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <FlaskConical className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{amostra.nome}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {amostra.registros.length} registro{amostra.registros.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            /* Timeline for selected exam */
            <div className="p-4 sm:p-5">
              <button
                onClick={() => setSelectedIndex(null)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar aos exames
              </button>

              <div className="bg-card border border-border rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-primary" />
                  <p className="text-sm font-bold text-foreground">{selectedAmostra.nome}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedAmostra.registros.length} registro{selectedAmostra.registros.length !== 1 ? "s" : ""}
                </p>
              </div>

              {selectedAmostra.registros.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center mt-8">
                  Nenhum registro de auditoria para este exame.
                </p>
              ) : (
                <div className="space-y-0">
                  {selectedAmostra.registros.map((entry, idx) => {
                    const cfg = acaoConfig[entry.acao] || defaultCfg;
                    const IconComp = cfg.icon;
                    return (
                      <div key={idx} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`p-2 rounded-xl ${cfg.bg} z-10 border-2 border-background`}>
                            <IconComp className={`h-4 w-4 ${cfg.color}`} />
                          </div>
                          {idx < selectedAmostra.registros.length - 1 && (
                            <div className="w-px flex-1 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <div className="bg-card rounded-xl border border-border p-3 hover:shadow-sm transition-shadow">
                            <p className="text-sm font-semibold text-foreground">{entry.acao}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-[10px]">{cfg.label}</Badge>
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {entry.dataHora}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className={`text-[8px] font-bold ${avatarColors[entry.iniciais] || "bg-muted text-muted-foreground"}`}>
                                  {entry.iniciais}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">{entry.usuario}</span>
                            </div>
                            {entry.dados && (
                              <pre className="text-xs text-foreground font-medium whitespace-pre-wrap leading-relaxed bg-muted/40 rounded-lg p-2.5 mt-2">
                                {entry.dados}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AuditoriaPanel;
