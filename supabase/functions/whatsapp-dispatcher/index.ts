// WhatsApp 2.0 — Dispatcher centralizado.
//
// Responsabilidade única: ler `whatsapp_outbox` (status pending ou retry vencido),
// chamar Meta Graph API com credenciais corporativas (env), gravar resultado
// em `whatsapp_outbox`, `whatsapp_mensagens` e `whatsapp_metrics_tenant`.
//
// Modos de invocação:
//   - Dispatcher imediato: chamado por `enqueueNotification` logo após enfileirar.
//   - Cron de retry: agendado a cada 1 min para reprocessar `failed` com backoff.

import { createClient } from "../_shared/runtime/createClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const META_PHONE_ID = Deno.env.get("WHATSAPP_META_PHONE_NUMBER_ID") ?? "";
const META_TOKEN = Deno.env.get("WHATSAPP_META_ACCESS_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BACKOFF_MIN = [1, 5, 30, 120, 480]; // minutos por tentativa

type OutboxRow = {
  id: string;
  tenant_id: string;
  telefone: string;
  template_nome: string;
  template_versao: string | null;
  idioma: string;
  variaveis: Record<string, unknown>;
  botoes: unknown;
  tentativa: number;
  max_tentativas: number;
  atendimento_protocolo: string | null;
  tipo_documento: string | null;
  idempotency_key: string;
};

function isPermanentError(code: number | undefined, msg: string): boolean {
  // 131026 = receiver incapable; 131000-131099 estrutural; 132xxx template;
  // 100/190 = token/permission
  if (!code) return false;
  if ([100, 190, 131026, 132000, 132001, 132005, 132007, 132012, 132015, 132016, 132068, 132069].includes(code)) return true;
  return false;
}

async function callMetaTemplate(row: OutboxRow): Promise<{ ok: boolean; messageId?: string; error?: string; code?: number; raw: unknown }> {
  if (!META_PHONE_ID || !META_TOKEN) {
    return { ok: false, error: "meta_credentials_missing", raw: null };
  }
  // Constrói components a partir das variáveis indexadas {{1}}..{{n}}
  const vars = row.variaveis ?? {};
  const ordered = Object.keys(vars)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => ({ type: "text" as const, text: String(vars[k] ?? "") }));

  const components: unknown[] = [];
  if (ordered.length > 0) components.push({ type: "body", parameters: ordered });

  // botão dinâmico com URL (opcional) — formato: { url_suffix: "..." }
  if (row.botoes && typeof row.botoes === "object" && (row.botoes as { url_suffix?: string }).url_suffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: (row.botoes as { url_suffix: string }).url_suffix }],
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    to: row.telefone,
    type: "template",
    template: {
      name: row.template_nome,
      language: { code: row.idioma || "pt_BR" },
      components,
    },
  };

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const err = (json as { error?: { message?: string; code?: number } }).error;
      return { ok: false, error: err?.message ?? `meta_http_${r.status}`, code: err?.code, raw: json };
    }
    const msgId = (json as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? null;
    if (!msgId) return { ok: false, error: "meta_no_message_id", raw: json };
    return { ok: true, messageId: msgId, raw: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), raw: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response("service unavailable", { status: 500, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // body opcional: { outbox_id?: string, batch?: number }
  let body: { outbox_id?: string; batch?: number } = {};
  try {
    if (req.method === "POST") body = await req.json();
  } catch { /* empty */ }

  const batchSize = Math.min(Math.max(body.batch ?? 20, 1), 100);

  // Seleção: item específico OU N itens pendentes/falhos com tempo vencido
  let rows: OutboxRow[] = [];
  if (body.outbox_id) {
    const { data } = await admin
      .from("whatsapp_outbox")
      .select("id,tenant_id,telefone,template_nome,template_versao,idioma,variaveis,botoes,tentativa,max_tentativas,atendimento_protocolo,tipo_documento,idempotency_key,status,proxima_tentativa_em")
      .eq("id", body.outbox_id)
      .in("status", ["pending", "failed"])
      .lte("proxima_tentativa_em", new Date().toISOString())
      .limit(1);
    rows = (data ?? []) as OutboxRow[];
  } else {
    const { data } = await admin
      .from("whatsapp_outbox")
      .select("id,tenant_id,telefone,template_nome,template_versao,idioma,variaveis,botoes,tentativa,max_tentativas,atendimento_protocolo,tipo_documento,idempotency_key")
      .in("status", ["pending", "failed"])
      .lte("proxima_tentativa_em", new Date().toISOString())
      .order("prioridade", { ascending: true })
      .order("criado_em", { ascending: true })
      .limit(batchSize);
    rows = (data ?? []) as OutboxRow[];
  }

  const results: Array<{ id: string; status: string; error?: string }> = [];

  for (const row of rows) {
    // marca sending (lock leve)
    const { error: lockErr } = await admin
      .from("whatsapp_outbox")
      .update({ status: "sending", tentativa: row.tentativa + 1 })
      .eq("id", row.id)
      .in("status", ["pending", "failed"]);
    if (lockErr) continue;

    const meta = await callMetaTemplate(row);
    const today = new Date().toISOString().slice(0, 10);

    if (meta.ok) {
      await admin.from("whatsapp_outbox").update({
        status: "sent",
        message_id: meta.messageId,
        erro: null,
      }).eq("id", row.id);

      await admin.from("whatsapp_mensagens").insert({
        tenant_id: row.tenant_id,
        atendimento_protocolo: row.atendimento_protocolo,
        telefone_destino: row.telefone,
        tipo_documento: row.tipo_documento ?? row.template_nome,
        message_id: meta.messageId,
        status: "sent",
        payload: meta.raw as Record<string, unknown> | null,
        idempotency_key: row.idempotency_key,
      });

      // métricas (upsert)
      await admin.rpc("exec_sql_void", {}).catch(() => null); // best-effort; usa upsert abaixo
      await admin.from("whatsapp_metrics_tenant").upsert({
        tenant_id: row.tenant_id,
        dia: today,
        enviados: 1,
        entregues: 0,
        lidos: 0,
        falhas: 0,
        opt_outs: 0,
      }, { onConflict: "tenant_id,dia", ignoreDuplicates: false });

      results.push({ id: row.id, status: "sent" });
    } else {
      const permanent = isPermanentError(meta.code, meta.error ?? "");
      const newAttempt = row.tentativa + 1;
      const failedFinal = permanent || newAttempt >= row.max_tentativas;
      const nextAt = failedFinal
        ? new Date().toISOString()
        : new Date(Date.now() + (BACKOFF_MIN[Math.min(newAttempt - 1, BACKOFF_MIN.length - 1)] * 60_000)).toISOString();

      await admin.from("whatsapp_outbox").update({
        status: failedFinal ? "failed_permanent" : "failed",
        erro: (meta.error ?? "unknown").slice(0, 500),
        proxima_tentativa_em: nextAt,
      }).eq("id", row.id);

      if (failedFinal) {
        await admin.from("whatsapp_mensagens").insert({
          tenant_id: row.tenant_id,
          atendimento_protocolo: row.atendimento_protocolo,
          telefone_destino: row.telefone,
          tipo_documento: row.tipo_documento ?? row.template_nome,
          message_id: null,
          status: "failed",
          erro: meta.error ?? null,
          payload: meta.raw as Record<string, unknown> | null,
        });
        await admin.from("whatsapp_metrics_tenant").upsert({
          tenant_id: row.tenant_id,
          dia: today,
          enviados: 0,
          entregues: 0,
          lidos: 0,
          falhas: 1,
          opt_outs: 0,
        }, { onConflict: "tenant_id,dia", ignoreDuplicates: false });
      }

      results.push({ id: row.id, status: failedFinal ? "failed_permanent" : "failed", error: meta.error });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
