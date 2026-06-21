// Fase 5 — Caixa Operacional (UI mínima).
// Card único usado no Dashboard e dentro da aba "Caixa" em /financeiro.
//
// Estados visíveis para a recepção:
//   • Caixa Fechado → botão "Abrir caixa"
//   • Caixa Aberto  → resumo + botão "Fechar caixa"
//
// Nada além disso. Sem dropdown de operador, sem múltiplos turnos.
import { useEffect, useState, useCallback } from "react";
import { Lock, Unlock, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getUnidades } from "@/data/unidadeStore";

import {
  abrirCaixa, fecharCaixa, getCaixaAbertaPorUnidade,
  type CaixaSessao, type CaixaFechamentoResumo,
} from "@/data/caixaSessoesStore";
import { imprimirComprovanteFechamento } from "@/lib/comprovanteCaixa";
import { fmtBRL } from "@/lib/utils";
import { formatDateBR } from "@/lib/dateBR";

interface Props {
  /** Layout compacto para uso no Dashboard. */
  compact?: boolean;
}

export default function CaixaOperacionalCard({ compact = false }: Props) {
  const { user, hasPermission } = useAuth();
  const podeOperar = hasPermission("gestao_financeira");
  const unidadeId = user?.unidadeAtiva ?? "";
  const unidadeNome =
    getUnidades().find((u) => u.id === unidadeId)?.nome ?? unidadeId ?? "Unidade";

  const [loading, setLoading] = useState(true);
  const [sessao, setSessao] = useState<CaixaSessao | null>(null);
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);

  const refresh = useCallback(async () => {
    if (!unidadeId) { setSessao(null); setLoading(false); return; }
    setLoading(true);
    try { setSessao(await getCaixaAbertaPorUnidade(unidadeId)); }
    catch { /* erro já tratado em store */ }
    finally { setLoading(false); }
  }, [unidadeId]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!podeOperar) return null;

  const status = sessao ? "aberta" : "fechada";

  return (
    <div className={`rounded-lg border border-border bg-card p-4 sm:p-5 ${compact ? "" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${status === "aberta" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Caixa · {unidadeNome}
            </p>
          </div>
          <h3 className="mt-1 text-lg font-semibold text-foreground">
            {loading ? "Verificando…" : status === "aberta" ? "Caixa aberto" : "Caixa fechado"}
          </h3>
          {sessao && (
            <p className="mt-1 text-xs text-muted-foreground">
              Aberto em {formatDateBR(sessao.aberta_em)} · Saldo inicial {fmtBRL(Number(sessao.valor_abertura))}
            </p>
          )}
        </div>
        <div className="shrink-0">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : sessao ? (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setOpenFechar(true)}>
              <Lock className="h-4 w-4" /> Fechar caixa
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={() => setOpenAbrir(true)}>
              <Unlock className="h-4 w-4" /> Abrir caixa
            </Button>
          )}
        </div>
      </div>

      <AbrirCaixaDialog
        open={openAbrir}
        onClose={() => setOpenAbrir(false)}
        unidadeId={unidadeId}
        unidadeNome={unidadeNome}
        onAberto={() => { setOpenAbrir(false); refresh(); }}
      />
      <FecharCaixaDialog
        open={openFechar}
        onClose={() => setOpenFechar(false)}
        sessao={sessao}
        unidadeNome={unidadeNome}
        userName={user?.nome ?? ""}
        onFechado={() => { setOpenFechar(false); refresh(); }}
      />
    </div>
  );
}

/* ───────── Abrir ───────── */
function AbrirCaixaDialog({ open, onClose, unidadeId, unidadeNome, onAberto }: {
  open: boolean; onClose: () => void; unidadeId: string; unidadeNome: string; onAberto: () => void;
}) {
  const [valor, setValor] = useState("0,00");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setValor("0,00"); setObs(""); } }, [open]);

  const submit = async () => {
    const num = Number(valor.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(num) || num < 0) {
      toast({ title: "Valor inválido", variant: "destructive" }); return;
    }
    setBusy(true);
    try {
      await abrirCaixa({ unidadeId, valorAbertura: num, observacoes: obs.trim() || null });
      toast({ title: "Caixa aberto", description: `${unidadeNome} · saldo inicial ${valor}` });
      onAberto();
    } catch { /* showError no store */ }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa — {unidadeNome}</DialogTitle>
          <DialogDescription>Informe o saldo inicial em dinheiro presente no caixa.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="valor-abertura">Saldo inicial (R$)</Label>
            <Input id="valor-abertura" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label htmlFor="obs-abertura">Observações (opcional)</Label>
            <Textarea id="obs-abertura" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Abrir caixa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Fechar ───────── */
function FecharCaixaDialog({ open, onClose, sessao, unidadeNome, userName, onFechado }: {
  open: boolean; onClose: () => void; sessao: CaixaSessao | null;
  unidadeNome: string; userName: string; onFechado: () => void;
}) {
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumo, setResumo] = useState<CaixaFechamentoResumo | null>(null);

  useEffect(() => { if (open) { setObs(""); setResumo(null); } }, [open]);

  if (!sessao) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const r = await fecharCaixa({ sessaoId: sessao.id, observacoes: obs.trim() || null });
      setResumo(r);
      toast({ title: "Caixa fechado", description: `Saldo final ${fmtBRL(Number(r.saldo_final))}` });
    } catch { /* showError no store */ }
    finally { setBusy(false); }
  };

  const imprimir = () => {
    if (!resumo) return;
    imprimirComprovanteFechamento({
      resumo, unidadeNome,
      abertoPor: userName, fechadoPor: userName,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa — {unidadeNome}</DialogTitle>
          <DialogDescription>
            {resumo
              ? "Caixa fechado. Imprima o comprovante para conferência."
              : "Confirma o fechamento? O saldo é calculado automaticamente."}
          </DialogDescription>
        </DialogHeader>

        {resumo ? (
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5 text-sm tabular-nums">
            <Linha label="Saldo de abertura" valor={resumo.valor_abertura} />
            <Linha label="Entradas em dinheiro" valor={resumo.entradas_dinheiro} sign="+" tone="positive" />
            <Linha label="Entradas em PIX" valor={resumo.entradas_pix} sign="+" tone="positive" />
            <Linha label="Saídas pagas" valor={resumo.saidas} sign="-" tone="negative" />
            <div className="border-t border-border pt-2 mt-2 flex items-center justify-between font-semibold">
              <span>Saldo final</span><span>{fmtBRL(Number(resumo.saldo_final))}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Aberto em <strong>{formatDateBR(sessao.aberta_em)}</strong> ·
              saldo inicial <strong>{fmtBRL(Number(sessao.valor_abertura))}</strong>
            </div>
            <div>
              <Label htmlFor="obs-fechar">Observações (opcional)</Label>
              <Textarea id="obs-fechar" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          {resumo ? (
            <>
              <Button variant="outline" onClick={() => { onFechado(); }}>Concluir</Button>
              <Button onClick={imprimir} className="gap-2">
                <Printer className="h-4 w-4" /> Imprimir comprovante
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button onClick={submit} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Fechar caixa
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Linha({ label, valor, sign, tone }: { label: string; valor: number; sign?: "+" | "-"; tone?: "positive" | "negative" }) {
  const cls = tone === "positive" ? "text-emerald-600 dark:text-emerald-400"
    : tone === "negative" ? "text-rose-600 dark:text-rose-400" : "text-foreground";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls}>{sign ?? ""} {fmtBRL(Number(valor))}</span>
    </div>
  );
}
