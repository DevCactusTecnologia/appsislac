// Central de Notificações — WhatsApp 2.0
// Painel somente de visualização para Super Admin: KPIs do dia, lista
// outbox, templates (cache da Meta) e opt-outs. Sem editor de campanha,
// chatbot, IA ou disparo em massa.

import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Send, AlertCircle, CheckCircle2, Eye, Ban } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type OutboxRow = {
  id: string;
  tenant_id: string;
  telefone: string;
  template_nome: string;
  status: string;
  tentativa: number;
  erro: string | null;
  criado_em: string;
  message_id: string | null;
};
type MetricRow = { tenant_id: string; enviados: number; entregues: number; lidos: number; falhas: number; opt_outs: number };
type TemplateRow = { nome: string; idioma: string; categoria: string | null; status: string; corpo: string | null; sincronizado_em: string };
type OptOutRow = { id: string; tenant_id: string | null; telefone: string | null; motivo: string | null; origem: string; criado_em: string };

function statusBadge(s: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    sending: "bg-blue-50 text-blue-700 border-blue-200",
    sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
    delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
    read: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
    failed_permanent: "bg-rose-100 text-rose-800 border-rose-300",
    opted_out: "bg-slate-100 text-slate-700 border-slate-300",
    rate_limited: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return <Badge variant="outline" className={`${map[s] ?? ""} font-mono text-xs`}>{s}</Badge>;
}

export default function SuperAdminNotificacoes() {
  const [tab, setTab] = useState<"outbox" | "templates" | "opt_out">("outbox");
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [optOut, setOptOut] = useState<OptOutRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  async function load() {
    setLoading(true);
    try {
      const [oRes, mRes, tRes, optRes] = await Promise.all([
        supabase.from("whatsapp_outbox" as never).select("id,tenant_id,telefone,template_nome,status,tentativa,erro,criado_em,message_id").order("criado_em", { ascending: false }).limit(200),
        supabase.from("whatsapp_metrics_tenant" as never).select("tenant_id,enviados,entregues,lidos,falhas,opt_outs").eq("dia", today),
        supabase.from("whatsapp_templates_cache" as never).select("nome,idioma,categoria,status,corpo,sincronizado_em").order("nome"),
        supabase.from("whatsapp_opt_out" as never).select("id,tenant_id,telefone,motivo,origem,criado_em").order("criado_em", { ascending: false }).limit(100),
      ]);
      setOutbox((oRes.data ?? []) as OutboxRow[]);
      setMetrics((mRes.data ?? []) as MetricRow[]);
      setTemplates((tRes.data ?? []) as TemplateRow[]);
      setOptOut((optRes.data ?? []) as OptOutRow[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => metrics.reduce((acc, m) => ({
    enviados: acc.enviados + (m.enviados ?? 0),
    entregues: acc.entregues + (m.entregues ?? 0),
    lidos: acc.lidos + (m.lidos ?? 0),
    falhas: acc.falhas + (m.falhas ?? 0),
    opt_outs: acc.opt_outs + (m.opt_outs ?? 0),
  }), { enviados: 0, entregues: 0, lidos: 0, falhas: 0, opt_outs: 0 }), [metrics]);

  const outboxFiltered = filterStatus ? outbox.filter((o) => o.status === filterStatus) : outbox;

  async function reprocessar(id: string) {
    await (supabase.from("whatsapp_outbox" as never) as never as { update: (v: unknown) => { eq: (c: string, v: string) => Promise<unknown> } }).update({ status: "pending", proxima_tentativa_em: new Date().toISOString(), erro: null }).eq("id", id);
    await supabase.functions.invoke("whatsapp-dispatcher", { body: { outbox_id: id } }).catch(() => null);
    toast({ title: "Reenfileirado", description: "Item enviado ao dispatcher." });
    void load();
  }

  async function sincronizarTemplates() {
    setLoading(true);
    const { error } = await supabase.functions.invoke("whatsapp-template-sync", { body: {} });
    if (error) toast({ title: "Falha no sync", description: error.message, variant: "destructive" });
    else toast({ title: "Templates sincronizados" });
    await load();
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Central de Notificações</h1>
          <p className="text-sm text-muted-foreground">WhatsApp corporativo — somente leitura. Meta é a fonte de verdade dos templates.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </header>

      {/* KPIs do dia */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Enviados hoje", v: totals.enviados, icon: Send, c: "text-indigo-600" },
          { l: "Entregues", v: totals.entregues, icon: CheckCircle2, c: "text-emerald-600" },
          { l: "Lidos", v: totals.lidos, icon: Eye, c: "text-blue-600" },
          { l: "Falhas", v: totals.falhas, icon: AlertCircle, c: "text-rose-600" },
          { l: "Opt-outs", v: totals.opt_outs, icon: Ban, c: "text-slate-600" },
        ].map((k) => (
          <Card key={k.l} className="p-4">
            <div className={`flex items-center gap-2 ${k.c}`}><k.icon className="h-4 w-4" /><span className="text-xs uppercase tracking-wide">{k.l}</span></div>
            <div className="text-2xl font-semibold mt-1">{k.v}</div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(["outbox", "templates", "opt_out"] as const).map((t) => (
          <button key={t}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => setTab(t)}>
            {t === "outbox" ? "Outbox" : t === "templates" ? "Templates (Meta)" : "Opt-outs"}
          </button>
        ))}
      </div>

      {tab === "outbox" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            {["", "pending", "sending", "sent", "failed", "failed_permanent", "opted_out", "rate_limited"].map((s) => (
              <button key={s || "all"} onClick={() => setFilterStatus(s)}
                className={`text-xs px-2 py-1 rounded border ${filterStatus === s ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-muted"}`}>
                {s || "todos"}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Criado</th>
                  <th className="text-left px-2">Template</th>
                  <th className="text-left px-2">Telefone</th>
                  <th className="text-left px-2">Status</th>
                  <th className="text-right px-2">Tent.</th>
                  <th className="text-left px-2">Erro</th>
                  <th className="text-right px-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {outboxFiltered.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-mono text-xs">{new Date(o.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="px-2">{o.template_nome}</td>
                    <td className="px-2 font-mono text-xs">{o.telefone}</td>
                    <td className="px-2">{statusBadge(o.status)}</td>
                    <td className="px-2 text-right">{o.tentativa}</td>
                    <td className="px-2 text-xs text-rose-600 max-w-[280px] truncate">{o.erro}</td>
                    <td className="px-2 text-right">
                      {["failed", "failed_permanent", "rate_limited"].includes(o.status) && (
                        <Button size="sm" variant="ghost" onClick={() => reprocessar(o.id)}>Reenfileirar</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {outboxFiltered.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nenhum item.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "templates" && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Cache local sincronizado da Meta Business. Nenhum cadastro manual é permitido.</p>
            <Button size="sm" onClick={sincronizarTemplates} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Sincronizar com Meta
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Nome</th>
                  <th className="text-left px-2">Idioma</th>
                  <th className="text-left px-2">Categoria</th>
                  <th className="text-left px-2">Status</th>
                  <th className="text-left px-2">Corpo</th>
                  <th className="text-left px-2">Sincronizado</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.nome + t.idioma} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-mono text-xs">{t.nome}</td>
                    <td className="px-2">{t.idioma}</td>
                    <td className="px-2 text-xs">{t.categoria}</td>
                    <td className="px-2">{statusBadge(t.status?.toLowerCase() ?? "unknown")}</td>
                    <td className="px-2 max-w-[420px] truncate text-xs text-muted-foreground">{t.corpo}</td>
                    <td className="px-2 font-mono text-xs">{new Date(t.sincronizado_em).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum template sincronizado. Clique em "Sincronizar com Meta".</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "opt_out" && (
        <Card className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Quando</th>
                  <th className="text-left px-2">Escopo</th>
                  <th className="text-left px-2">Telefone</th>
                  <th className="text-left px-2">Origem</th>
                  <th className="text-left px-2">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {optOut.map((o) => (
                  <tr key={o.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-2 font-mono text-xs">{new Date(o.criado_em).toLocaleString("pt-BR")}</td>
                    <td className="px-2 text-xs">{o.tenant_id ? "tenant" : "global"}</td>
                    <td className="px-2 font-mono text-xs">{o.telefone}</td>
                    <td className="px-2 text-xs">{o.origem}</td>
                    <td className="px-2 text-xs text-muted-foreground">{o.motivo}</td>
                  </tr>
                ))}
                {optOut.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Nenhum opt-out registrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
