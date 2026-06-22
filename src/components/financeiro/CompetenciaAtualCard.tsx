// Convênios 2.0 — Fase 4
// Card de Competência Atual: KPIs e ações de fechamento/reabertura.
// Consome EXCLUSIVAMENTE convenio_competencia_resumo (SSOT).
import { useEffect, useState } from "react";
import { Calendar, Lock, Unlock, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn, fmtBRL } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  fetchCompetenciaAtual,
  fecharCompetencia,
  reabrirCompetencia,
  type CompetenciaResumo,
} from "@/data/convenioCompetenciasStore";
import { useAuth } from "@/contexts/AuthContext";

function formatComp(yyyymm: string): string {
  if (!/^\d{4}-\d{2}$/.test(yyyymm)) return yyyymm;
  const [y, m] = yyyymm.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${meses[Number(m) - 1] ?? m}/${y}`;
}

export default function CompetenciaAtualCard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [resumo, setResumo] = useState<CompetenciaResumo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dlgFechar, setDlgFechar] = useState(false);
  const [dlgReabrir, setDlgReabrir] = useState(false);
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");

  async function reload() {
    setLoading(true);
    const r = await fetchCompetenciaAtual();
    setResumo(r);
    setLoading(false);
  }

  useEffect(() => { reload(); }, []);

  async function handleFechar() {
    if (!resumo) return;
    setBusy(true);
    const r = await fecharCompetencia(resumo.competencia, obs);
    setBusy(false);
    if (r.ok) {
      toast({ title: "Competência fechada", description: `Competência ${formatComp(resumo.competencia)} fechada com sucesso.` });
      setDlgFechar(false); setObs(""); reload();
    } else {
      toast({ title: "Falha ao fechar", description: r.error ?? "Erro desconhecido", variant: "destructive" });
    }
  }

  async function handleReabrir() {
    if (!resumo) return;
    setBusy(true);
    const r = await reabrirCompetencia(resumo.competencia, motivo);
    setBusy(false);
    if (r.ok) {
      toast({ title: "Competência reaberta", description: `Competência ${formatComp(resumo.competencia)} reaberta.` });
      setDlgReabrir(false); setMotivo(""); reload();
    } else {
      toast({ title: "Falha ao reabrir", description: r.error ?? "Erro desconhecido", variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm text-muted-foreground">
        Carregando competência…
      </div>
    );
  }
  if (!resumo) return null;

  const fechada = resumo.status === "fechada";

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">Competência atual</p>
            <p className="text-sm font-semibold text-foreground">{formatComp(resumo.competencia)}</p>
          </div>
          <span className={cn(
            "ml-2 inline-flex items-center gap-1.5 px-2 h-6 rounded-md border text-[11px] font-medium",
            fechada
              ? "bg-muted text-muted-foreground border-border"
              : "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", fechada ? "bg-muted-foreground/50" : "bg-emerald-500")} />
            {fechada ? "Fechada" : "Aberta"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reload} className="h-8 gap-1.5 text-[11px]">
            <RefreshCcw className="h-3 w-3" /> Atualizar
          </Button>
          {!fechada ? (
            <Button size="sm" onClick={() => setDlgFechar(true)} className="h-8 gap-1.5 text-[11px]">
              <Lock className="h-3 w-3" /> Fechar competência
            </Button>
          ) : isAdmin ? (
            <Button size="sm" variant="outline" onClick={() => setDlgReabrir(true)} className="h-8 gap-1.5 text-[11px]">
              <Unlock className="h-3 w-3" /> Reabrir
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border/40">
        <Kpi label="Faturado" value={resumo.totalFaturado} subtle={`${resumo.qtdFaturas} fatura(s)`} />
        <Kpi label="Recebido" value={resumo.totalRecebido} accent="emerald" />
        <Kpi label="Glosado" value={resumo.totalGlosado} accent="amber" subtle={`em aberto ${fmtBRL(resumo.totalGlosadoAberto)}`} />
        <Kpi label="Reapresentado" value={resumo.totalReapresentado} />
        <Kpi label="Saldo" value={resumo.saldoPendente} accent={resumo.saldoPendente > 0 ? "primary" : "muted"} />
      </div>

      <Dialog open={dlgFechar} onOpenChange={(o) => !busy && setDlgFechar(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar competência {formatComp(resumo.competencia)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Após fechada, faturas, itens e glosas desta competência ficam travados.
              Apenas admin/super_admin pode reabrir.
            </p>
            <Textarea
              placeholder="Observação (opcional)"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgFechar(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={handleFechar} disabled={busy}>Fechar competência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dlgReabrir} onOpenChange={(o) => !busy && setDlgReabrir(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reabrir competência {formatComp(resumo.competencia)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Esta ação é auditada. Informe o motivo da reabertura.
            </p>
            <Textarea
              placeholder="Motivo da reabertura (obrigatório)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgReabrir(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={handleReabrir} disabled={busy || !motivo.trim()}>Reabrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label, value, subtle, accent = "default",
}: {
  label: string;
  value: number;
  subtle?: string;
  accent?: "default" | "emerald" | "amber" | "primary" | "muted";
}) {
  const accentCls: Record<string, string> = {
    default: "text-foreground",
    emerald: "text-emerald-600 dark:text-emerald-400",
    amber:   "text-amber-600 dark:text-amber-400",
    primary: "text-primary",
    muted:   "text-muted-foreground",
  };
  return (
    <div className="bg-card px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-semibold">{label}</span>
      <span className={cn("text-base font-semibold tabular-nums", accentCls[accent])}>{fmtBRL(value)}</span>
      {subtle && <span className="text-[10px] text-muted-foreground tabular-nums">{subtle}</span>}
    </div>
  );
}
