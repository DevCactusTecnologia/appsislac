// ai-chat — única Edge Function do Assistente do SISLAC.
// Responsabilidades: JWT, tenant resolver, permissões, contexto, registry, streaming, auditoria.
// NUNCA: SQL direto, lógica de negócio, tenant vindo do frontend.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { convertToModelMessages, streamText, type UIMessage } from "npm:ai@4.3.16";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible@0.2.16";
import { CAPABILITIES } from "./registry.ts";
import { buildPacienteTools } from "./skills/paciente.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AIContext {
  module?: string;
  route?: { path?: string; params?: Record<string, string> };
  focus?: Record<string, string | undefined>;
}

async function checkPermission(
  admin: ReturnType<typeof createClient>,
  userId: string,
  permission: string,
): Promise<boolean> {
  const { data, error } = await admin.rpc("has_permission", {
    _user_id: userId,
    _permission: permission,
  });
  if (error) return false;
  return Boolean(data);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "missing_lovable_api_key" }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // Resolver usuário e tenant SERVER-SIDE
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const { data: tenantRpc } = await userClient.rpc("current_tenant_id");
  const tenantId = (tenantRpc as string | null) ?? null;
  if (!tenantId) {
    return new Response(JSON.stringify({ error: "tenant_unresolved" }), {
      status: 403, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let body: { messages?: UIMessage[]; context?: AIContext; threadId?: string };
  try { body = await req.json(); } catch { body = {}; }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const ctx = body.context ?? {};

  // Filtrar capabilities por permissão
  const allowed = [] as typeof CAPABILITIES;
  for (const cap of CAPABILITIES) {
    if (!cap.permission) { allowed.push(cap); continue; }
    if (await checkPermission(admin, userId, cap.permission)) allowed.push(cap);
  }

  // Tools (apenas as autorizadas)
  const allTools = buildPacienteTools(userClient);
  const toolMap: Record<string, unknown> = {};
  for (const cap of allowed) {
    const key = cap.id.replace(".", "_");
    if (key in allTools) toolMap[key] = (allTools as Record<string, unknown>)[key];
  }

  const systemPrompt =
    `Você é o Assistente do SISLAC, um colaborador experiente do laboratório. ` +
    `Profissional, objetivo, silencioso. Nunca se identifique como IA. ` +
    `Use SEMPRE as ferramentas disponíveis para executar tarefas. ` +
    `Não invente dados. Não gere SQL. Contexto atual: ${JSON.stringify(ctx)}. ` +
    `Capacidades autorizadas: ${allowed.map((c) => `${c.id} (${c.label})`).join(", ") || "nenhuma"}.`;

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": LOVABLE_API_KEY,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

  try {
    const result = streamText({
      model: gateway("google/gemini-3-flash-preview"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      tools: toolMap as never,
      maxSteps: 5,
      onFinish: async ({ text, usage, finishReason }) => {
        const duration = Date.now() - started;
        await admin.from("ai_audit").insert({
          tenant_id: tenantId,
          user_id: userId,
          thread_id: body.threadId ?? null,
          skill: "router",
          capability: null,
          action: null,
          status: finishReason === "error" ? "error" : "ok",
          duration_ms: duration,
          needs_approval: false,
          origin: "ai-chat",
          metadata: { usage, finishReason, text_len: text?.length ?? 0 },
        });
      },
    });

    return result.toUIMessageStreamResponse({ headers: corsHeaders });
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    await admin.from("ai_audit").insert({
      tenant_id: tenantId, user_id: userId, skill: "router",
      status: "error", duration_ms: Date.now() - started,
      origin: "ai-chat", error_code: "STREAM_FAIL", metadata: { message: msg },
    });
    return new Response(JSON.stringify({ error: "stream_failed", message: msg }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
