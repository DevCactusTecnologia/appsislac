// WhatsApp 2.0 — Fase 3F.2 — Timeline de comunicação
// ------------------------------------------------------------------
// Lê `whatsapp_outbox` por `atendimento_protocolo` (RLS por tenant)
// e exibe um histórico compacto dos disparos com status visual.
//
// Aplicado APENAS no `AtendimentoDetalheDialog` (decisão de produto:
// não onerar listagens com queries de status).

import { useEffect, useState } from "react";
import { MessageCircle, Check, Clock, AlertTriangle, Ban } from "lucide-react";
import { db as supabase } from "@/runtime/db";

interface OutboxRow {
  id: string;
  template_nome: string;
  tipo_documento: string | null;
  status: string;
  criado_em: string;
  erro: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  comprovante_atendimento: "Comprovante de atendimento",
  comprovante_pagamento: "Comprovante de pagamento",
  resultado_pronto: "Aviso de resultado pronto",
  recoleta: "Aviso de recoleta",
  orcamento: "Orçamento",
};

function statusMeta(status: string) {
  switch (status) {
    case "sent":
      return { label: "Enviado", Icon: Check, color: "hsl(var(--status-success))" };
    case "pending":
    case "sending":
      return { label: "Pendente", Icon: Clock, color: "hsl(var(--status-warning))" };
    case "failed":
    case "failed_permanent":
      return { label: "Falhou", Icon: AlertTriangle, color: "hsl(var(--status-danger))" };
    case "opted_out":
      return { label: "Opt-out", Icon: Ban, color: "hsl(var(--status-neutral))" };
    case "rate_limited":
      return { label: "Limite atingido", Icon: Clock, color: "hsl(var(--status-warning))" };
    case "cancelled":
      return { label: "Cancelado", Icon: Ban, color: "hsl(var(--status-neutral))" };
    default:
      return { label: status, Icon: Clock, color: "hsl(var(--muted-foreground))" };
  }
}

function formatBR(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

interface Props {
  protocolo: string;
  /** Re-fetcha quando muda (ex.: após disparo manual). */
  refreshKey?: number;
}

export function WhatsappTimeline({ protocolo, refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("whatsapp_outbox")
          .select("id, template_nome, tipo_documento, status, criado_em, erro")
          .eq("atendimento_protocolo", protocolo)
          .order("criado_em", { ascending: false })
          .limit(20);
        if (!cancelled) setRows((data ?? []) as OutboxRow[]);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [protocolo, refreshKey]);

  if (loading) {
    return (
      <p className="text-[11px] text-muted-foreground italic">Carregando histórico…</p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">
        Nenhuma mensagem enviada por WhatsApp ainda.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const meta = statusMeta(r.status);
        const Icon = meta.Icon;
        const tipo = r.tipo_documento ?? r.template_nome;
        const label = TIPO_LABEL[tipo] ?? tipo;
        return (
          <li
            key={r.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-3.5 w-3.5 text-[hsl(142,70%,45%)] shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-foreground truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground">{formatBR(r.criado_em)}</p>
              </div>
            </div>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-semibold shrink-0"
              style={{ color: meta.color }}
              title={r.erro ?? undefined}
            >
              <Icon className="h-3 w-3" />
              {meta.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default WhatsappTimeline;
