// PainelTab — Fase 3 do Financeiro V2 (Laboratorial Simples e Profissional).
//
// Painel financeiro com 6 cards apenas:
//   1. Receita Hoje       2. Receita Mês        3. A Receber
//   4. Despesas Mês       5. Saldo Atual        6. Convênios Pendentes
//
// Filosofia: olhou, entendeu, usou. Nenhum gráfico, nenhum indicador técnico.
import { motion } from "framer-motion";
import {
  Wallet, TrendingUp, Clock, ArrowUpCircle, CircleDollarSign, Building2,
} from "lucide-react";
import { fmtBRL } from "@/lib/utils";
import { useFinanceiroContext } from "../FinanceiroContext";

interface CardDef {
  key: string;
  label: string;
  value: string;
  hint?: string;
  Icon: typeof Wallet;
  /** Tom semântico do valor: positivo, neutro, alerta. */
  tone: "positive" | "neutral" | "warning" | "negative";
}

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c, i) => {
        const Icon = c.Icon;
        const valueClass =
          c.tone === "positive" ? "text-emerald-600 dark:text-emerald-400"
          : c.tone === "warning"  ? "text-amber-600 dark:text-amber-400"
          : c.tone === "negative" ? "text-rose-600 dark:text-rose-400"
          : "text-foreground";
        return (
          <motion.div
            key={c.key}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, delay: i * 0.02 }}
            className="rounded-2xl border border-border/40 bg-card p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.label}
              </span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>
              {c.value}
            </div>
            {c.hint && (
              <div className="text-xs text-muted-foreground">{c.hint}</div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
