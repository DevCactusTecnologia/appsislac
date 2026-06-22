// PainelTab — V4 (Dashboard hero + KPI grid).
//
// Layout dashboard:
//   • Hero card "Saldo do mês" (indigo wash, valor grande Sora).
//   • Receita Hoje + Receita Mês como cartões positivos secundários.
//   • Grid de KPIs operacionais (A Receber, Despesas, Convênios) abaixo.
import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, Clock, ArrowUpCircle, CircleDollarSign, Building2,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { fmtBRL, cn } from "@/lib/utils";
import { useFinanceiroContext } from "../FinanceiroContext";

interface CardDef {
  key: string;
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Wallet;
  tone: "positive" | "neutral" | "warning" | "negative";
}

const TONE_DOT: Record<CardDef["tone"], string> = {
  positive: "bg-emerald-500",
  warning:  "bg-amber-500",
  negative: "bg-rose-500",
  neutral:  "bg-muted-foreground/40",
};

const TONE_RING: Record<CardDef["tone"], string> = {
  positive: "ring-emerald-500/15 bg-emerald-500/5",
  warning:  "ring-amber-500/15 bg-amber-500/5",
  negative: "ring-rose-500/15 bg-rose-500/5",
  neutral:  "ring-border/60 bg-muted/30",
};

export default function PainelTab() {
  const { painelKpis } = useFinanceiroContext();

  const saldoPositivo = painelKpis.saldoAtual >= 0;

  const heroSecondary: CardDef[] = [
    {
      key: "receitaHoje",
      label: "Receita Hoje",
      value: fmtBRL(painelKpis.receitaHoje),
      hint: painelKpis.qtdEntradasHoje
        ? `${painelKpis.qtdEntradasHoje} ${painelKpis.qtdEntradasHoje === 1 ? "recebimento" : "recebimentos"}`
        : "Nenhum recebimento hoje",
      Icon: Wallet,
      tone: "positive",
    },
    {
      key: "receitaMes",
      label: "Receita Mês",
      value: fmtBRL(painelKpis.receitaMes),
      hint: painelKpis.qtdEntradasMes
        ? `${painelKpis.qtdEntradasMes} no mês`
        : "Nenhum recebimento no mês",
      Icon: TrendingUp,
      tone: "positive",
    },
  ];

  const cards: CardDef[] = [
    {
      key: "aReceber",
      label: "A Receber",
      value: fmtBRL(painelKpis.aReceberTotal),
      hint: painelKpis.qtdAReceberPacientes
        ? `${painelKpis.qtdAReceberPacientes} ${painelKpis.qtdAReceberPacientes === 1 ? "paciente" : "pacientes"} + convênios`
        : "Nenhum saldo em aberto",
      Icon: Clock,
      tone: painelKpis.aReceberTotal > 0 ? "warning" : "neutral",
    },
    {
      key: "despesasMes",
      label: "Despesas Mês",
      value: fmtBRL(painelKpis.despesasMes),
      hint: painelKpis.qtdDespesasMes
        ? `${painelKpis.qtdDespesasMes} ${painelKpis.qtdDespesasMes === 1 ? "despesa paga" : "despesas pagas"}`
        : "Nenhuma despesa paga no mês",
      Icon: ArrowUpCircle,
      tone: "neutral",
    },
    {
      key: "conveniosPendentes",
      label: "Convênios Pendentes",
      value: String(painelKpis.conveniosPendentes),
      hint: painelKpis.conveniosPendentes
        ? "Aguardando fechamento de fatura"
        : "Tudo faturado",
      Icon: Building2,
      tone: painelKpis.conveniosPendentes > 0 ? "warning" : "positive",
    },
  ];

  return (
    <div className="space-y-4">
      {/* ─── Hero: Saldo + receitas ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Saldo do mês — destaque */}
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="lg:col-span-1 relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent p-5"
        >
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">
              Saldo do mês
            </span>
            <div className="p-2 rounded-xl bg-primary/10 ring-1 ring-primary/20 text-primary">
              <CircleDollarSign className="h-4 w-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className={cn(
            "relative font-display font-semibold tabular-nums leading-none mt-4 text-[34px]",
            saldoPositivo ? "text-foreground" : "text-rose-600",
          )}>
            {fmtBRL(painelKpis.saldoAtual)}
          </div>
          <div className="relative flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
            {saldoPositivo
              ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
              : <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />}
            <span>Receitas − Despesas no mês</span>
          </div>
        </motion.div>

        {/* Receita Hoje + Receita Mês */}
        {heroSecondary.map((c, i) => {
          const Icon = c.Icon;
          return (
            <motion.div
              key={c.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.04 + i * 0.04 }}
              className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.18)] transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {c.label}
                </span>
                <div className={cn("p-2 rounded-xl ring-1", TONE_RING[c.tone])}>
                  <Icon className="h-4 w-4 text-emerald-600" strokeWidth={1.75} />
                </div>
              </div>
              <div className="font-display font-semibold tabular-nums text-[26px] leading-none mt-4 text-foreground">
                {c.value}
              </div>
              {c.hint && (
                <div className="text-xs text-muted-foreground mt-2.5">{c.hint}</div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ─── Linha operacional: A Receber, Despesas, Convênios ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c, i) => {
          const Icon = c.Icon;
          return (
            <motion.div
              key={c.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.12 + i * 0.04 }}
              className="group relative rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/30 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.18)] transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[c.tone])} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    {c.label}
                  </span>
                </div>
                <div className={cn("p-1.5 rounded-lg ring-1", TONE_RING[c.tone])}>
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                </div>
              </div>
              <div className="font-display font-semibold tabular-nums text-[22px] leading-none mt-4 text-foreground">
                {c.value}
              </div>
              {c.hint && (
                <div className="text-xs text-muted-foreground mt-2.5">{c.hint}</div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
