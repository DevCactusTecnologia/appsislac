// Edge Function: integration-poll-results
// ---------------------------------------
// Sincronização incremental: para cada integração ATIVA, varre os exames
// terceirizados do tenant que possuem protocolo externo e ainda não foram
// importados, e cria jobs POLL_RESULT correspondentes (idempotente).

import { getAdminClient, logIntegration, safeEq } from "../_shared/integrationLog.ts";
import { withCronHealth } from "../_shared/cronHealth.ts";

import { corsHeaders } from "../_shared/cors.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) return json(503, { ok: false, error: "service unavailable" });
  if (!safeEq(req.headers.get("x-cron-secret") ?? "", expected)) {
    return json(401, { ok: false, error: "unauthorized" });
  }

  const admin = getAdminClient();

  return withCronHealth(admin, "integration-poll-results", async () => {
   try {
    const { data: integrations, error } = await admin
      .from("integrations")
      .select("id, tenant_id, provider, polling_interval_seconds")
      .eq("ativo", true);
    if (error) throw error;

    let totalCriados = 0;

    for (const integ of integrations ?? []) {
      try {
        // Verifica último sync para respeitar o intervalo configurado
        const { data: ss } = await admin
          .from("integration_sync_state")
          .select("last_sync_at")
          .eq("integration_id", integ.id)
          .eq("scope", "RESULTS")
          .maybeSingle();
        const interval = (integ.polling_interval_seconds ?? 300) * 1000;
        if (ss?.last_sync_at && Date.now() - new Date(ss.last_sync_at).getTime() < interval) {
          continue;
        }

        // Busca exames pendentes do tenant
        const { data: pendentes } = await admin
          .from("atendimento_exames")
          .select("id, protocolo_externo")
          .eq("tenant_id", integ.tenant_id)
          .eq("tipo_processo", "TERCEIRIZADO")
          .eq("integracao_ativa", true)
          .in("status_externo", ["ENVIADO", "EM_ANALISE_LAB"])
          .not("protocolo_externo", "is", null)
          .limit(50);

        let criados = 0;
        for (const ex of pendentes ?? []) {
          // Idempotência: não cria se já existe job POLL_RESULT pendente p/ este protocolo
          const { data: jaExiste } = await admin
            .from("integration_jobs")
            .select("id")
            .eq("integration_id", integ.id)
            .eq("kind", "POLL_RESULT")
            .in("status", ["PENDING", "PROCESSING"])
            .contains("payload", { external_protocol: ex.protocolo_externo })
            .maybeSingle();
          if (jaExiste) continue;

          await admin.from("integration_jobs").insert({
            tenant_id: integ.tenant_id,
            integration_id: integ.id,
            kind: "POLL_RESULT",
            status: "PENDING",
            priority: 5,
            payload: {
              external_protocol: ex.protocolo_externo,
              atendimento_exame_id: ex.id,
            },
          });
          criados++;
        }

        await admin
          .from("integration_sync_state")
          .upsert(
            {
              tenant_id: integ.tenant_id,
              integration_id: integ.id,
              scope: "RESULTS",
              last_sync_at: new Date().toISOString(),
              status: "OK",
            },
            { onConflict: "integration_id,scope" } as any,
          );

        totalCriados += criados;
        await logIntegration(admin, {
          tenant_id: integ.tenant_id,
          integration_id: integ.id,
          level: "INFO",
          message: "Poll incremental executado",
          context: { jobs_criados: criados, candidatos: pendentes?.length ?? 0 },
        });
      } catch (e) {
        await logIntegration(admin, {
          tenant_id: integ.tenant_id,
          integration_id: integ.id,
          level: "ERROR",
          message: "Falha no poll incremental",
          context: { error: e instanceof Error ? e.message : String(e) },
        });
      }
    }

    return {
      response: json(200, { ok: true, jobs_criados: totalCriados }),
      result: { items_processed: totalCriados, context: { integrations: integrations?.length ?? 0 } },
    };
   } catch (e) {
     console.error("[integration-poll-results] fatal", e);
     return { response: json(500, { ok: false, error: "internal_error" }) };
   }
  });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}