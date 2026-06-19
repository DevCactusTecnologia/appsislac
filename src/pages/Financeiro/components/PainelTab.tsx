// PainelTab — V3 (cards uniformes refinados, compactos).
//
// 6 KPIs em grid uniforme. Densidade compacta. Identidade flat + indigo.
//   • Acento de tom no canto (dot) em vez de cor no valor — mais sóbrio.
//   • Hierarquia: label · valor grande · hint.
import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, Clock, ArrowUpCircle, CircleDollarSign, Building2,
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

const TONE_VALUE: Record<CardDef["tone"], string> = {
  positive: "text-foreground",
  warning:  "text-foreground",
  negative: "text-rose-600 dark:text-rose-400",
  neutral:  "text-foreground",
};

export default function PainelTab() {
  const { painelKpis } = useFinanceiroContext();

  const cards: CardDef[] = [
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
        ? `${painelKpis.qtdEntradasMes} ${painelKpis.qtdEntradasMes === 1 ? "recebimento" : "recebimentos"} no mês`
        : "Nenhum recebimento no mês",
      Icon: TrendingUp,
      tone: "positive",
    },
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
      key: "saldoAtual",
      label: "Saldo Atual",
      value: fmtBRL(painelKpis.saldoAtual),
      hint: "Receitas − Despesas (mês)",
      Icon: CircleDollarSign,
      tone: painelKpis.saldoAtual >= 0 ? "positive" : "negative",
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c, i) => {
        const Icon = c.Icon;
        return (
          <motion.div
            key={c.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: i * 0.02 }}
            className="group relative rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-2 hover:border-border transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[c.tone])} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </span>
              </div>
              <Icon className="h-4 w-4 text-muted-foreground/70" strokeWidth={1.75} />
            </div>
            <div className={cn("text-[22px] font-semibold tabular-nums leading-tight", TONE_VALUE[c.tone])}>
              {c.value}
            </div>
            {c.hint && (
              <div className="text-[11px] text-muted-foreground">{c.hint}</div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
