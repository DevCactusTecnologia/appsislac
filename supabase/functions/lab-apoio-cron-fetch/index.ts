// Edge function: lab-apoio-cron-fetch
// ------------------------------------
// Job periódico (chamado via pg_cron) que varre todos os exames terceirizados
// com integração ativa e status_externo ∈ {ENVIADO, EM_ANALISE_LAB}, simulando
// consulta ao laboratório de apoio (mock). Em produção, esta função iteraria
// sobre cada lab e chamaria o adapter real correspondente.
//
// Segurança:
//  - Não exige JWT de usuário (chamada server-to-server pelo pg_cron).
//  - Validação por header `x-cron-secret` que deve bater com o secret CRON_SECRET.
//  - Usa service-role para escrever, mantendo isolamento via filtros explícitos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { withCronHealth } from "../_shared/cronHealth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Limite por execução para não estourar o tempo do edge runtime
const BATCH_LIMIT = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    console.error("[lab-apoio-cron-fetch] CRON_SECRET ausente no ambiente");
    return new Response(
      JSON.stringify({ ok: false, error: "service unavailable" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  {
    const provided = req.headers.get("x-cron-secret") ?? "";
    const a = new TextEncoder().encode(provided);
    const b = new TextEncoder().encode(expected);
    let diff = a.length ^ b.length;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supaUrl, serviceKey);

  return withCronHealth(admin, "lab-apoio-cron-fetch", async () => {
   try {
    // Busca pendentes
    const { data: pendentes, error: selErr } = await admin
      .from("atendimento_exames")
      .select("id, tenant_id, protocolo_externo, status_externo")
      .eq("tipo_processo", "TERCEIRIZADO")
      .eq("integracao_ativa", true)
      .in("status_externo", ["ENVIADO", "EM_ANALISE_LAB"])
      .not("protocolo_externo", "is", null)
      .limit(BATCH_LIMIT);

    if (selErr) throw selErr;

    const now = new Date().toISOString();
    let importados = 0;
    let emAnalise = 0;
    let erros = 0;

    for (const ex of pendentes ?? []) {
      try {
        // MOCK: 60% chance de "resultado disponível" a cada checagem
        const ready = Math.random() > 0.4;
        if (ready) {
          const { error: upErr } = await admin
            .from("atendimento_exames")
            .update({
              status_externo: "IMPORTADO",
              status: "finalizado",
              resultado_importado: true,
              data_retorno: now,
              data_liberacao: now,
            })
            .eq("id", ex.id);
          if (upErr) throw upErr;
          importados++;
        } else if (ex.status_externo !== "EM_ANALISE_LAB") {
          const { error: upErr } = await admin
            .from("atendimento_exames")
            .update({ status_externo: "EM_ANALISE_LAB" })
            .eq("id", ex.id);
          if (upErr) throw upErr;
          emAnalise++;
        } else {
          emAnalise++;
        }
      } catch (e) {
        erros++;
        console.error(`[cron-fetch] erro exame=${ex.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const summary = {
      ok: true,
      verificados: pendentes?.length ?? 0,
      importados,
      em_analise: emAnalise,
      erros,
      executed_at: now,
    };
    console.log("[lab-apoio-cron-fetch]", JSON.stringify(summary));

    return {
      response: new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
      result: {
        items_processed: pendentes?.length ?? 0,
        context: { importados, em_analise: emAnalise, erros },
      },
    };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[lab-apoio-cron-fetch] erro:", msg);
      return {
        response: new Response(JSON.stringify({ ok: false, error: "Erro interno no processamento do Lab Apoio" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }),
      };
    }
  });
});
