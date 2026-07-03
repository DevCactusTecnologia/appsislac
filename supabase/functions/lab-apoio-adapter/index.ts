// Edge function: lab-apoio-adapter (fachada pura)
// ------------------------------------------------
// Após a unificação de resiliência: este endpoint NÃO executa integração,
// NÃO gera protocolo e NÃO escreve em atendimento_exames diretamente.
// Apenas:
//  1) valida JWT do usuário e o tenant do exame;
//  2) resolve a integração configurada via labs_apoio.integration_id;
//  3) enfileira em integration_jobs (idempotency_key);
//  4) dispara integration-dispatch best-effort (o runner também processa);
//  5) devolve o estado atual do exame para compatibilidade com o frontend.

import { createClient } from "../_shared/runtime/createClient.ts";

import { corsHeaders } from "../_shared/cors.ts";
interface Body {
  action: "send" | "fetch";
  exame_id: number;
}

function jsonResp(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supaUrl, anonKey, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return jsonResp(401, { ok: false, error: "Não autenticado" });

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body || (body.action !== "send" && body.action !== "fetch") || typeof body.exame_id !== "number") {
      return jsonResp(400, { ok: false, error: "Payload inválido" });
    }

    const admin = createClient(supaUrl, serviceKey);

    const { data: exame, error: exErr } = await admin
      .from("atendimento_exames")
      .select("id, tenant_id, tipo_processo, integracao_ativa, lab_apoio_id, status_externo, protocolo_externo, atendimento_id")
      .eq("id", body.exame_id)
      .maybeSingle();
    if (exErr || !exame) return jsonResp(404, { ok: false, error: "Exame não encontrado" });

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!profile || profile.tenant_id !== exame.tenant_id) {
      return jsonResp(403, { ok: false, error: "Sem acesso ao tenant deste exame" });
    }

    if (exame.tipo_processo !== "TERCEIRIZADO" || !exame.integracao_ativa) {
      return jsonResp(400, { ok: false, error: "Exame sem integração ativa" });
    }

    // Resolve integration_id via lab. Sem integração configurada → 409 (sem fluxo paralelo).
    let integrationId: string | null = null;
    if (exame.lab_apoio_id) {
      const { data: lab } = await admin
        .from("labs_apoio")
        .select("integration_id")
        .eq("id", exame.lab_apoio_id)
        .maybeSingle();
      integrationId = (lab?.integration_id as string | null) ?? null;
    }
    if (!integrationId) {
      return jsonResp(409, {
        ok: false,
        error: "lab_sem_integracao_configurada",
        detail: "Configure uma integração para este laboratório de apoio antes de enviar/consultar exames.",
      });
    }

    if (body.action === "send") {
      const idempotencyKey = `SEND_ORDER:${exame.id}`;
      const { data: job, error: jobErr } = await admin
        .from("integration_jobs")
        .insert({
          tenant_id: exame.tenant_id,
          integration_id: integrationId,
          kind: "SEND_ORDER",
          status: "PENDING",
          payload: { atendimento_exame_id: exame.id },
          idempotency_key: idempotencyKey,
          scheduled_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (jobErr || !job) {
        // Idempotency hit: reaproveita o job mais recente desse exame.
        if (jobErr?.code === "23505") {
          const { data: existing } = await admin
            .from("integration_jobs")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing) {
            try { await admin.functions.invoke("integration-dispatch", { body: { job_id: existing.id } }); } catch (_) {}
            const { data: updated } = await admin
              .from("atendimento_exames")
              .select("protocolo_externo, status_externo")
              .eq("id", exame.id).maybeSingle();
            return jsonResp(200, {
              ok: true, job_id: existing.id,
              protocolo_externo: updated?.protocolo_externo ?? null,
              status_externo: updated?.status_externo ?? exame.status_externo,
              idempotent: true,
            });
          }
        }
        return jsonResp(500, { ok: false, error: jobErr?.message ?? "enqueue_failed" });
      }
      try { await admin.functions.invoke("integration-dispatch", { body: { job_id: job.id } }); }
      catch (e) { console.warn("[lab-apoio-adapter] dispatch async falhou; runner pegará:", e); }
      const { data: updated } = await admin
        .from("atendimento_exames")
        .select("protocolo_externo, status_externo")
        .eq("id", exame.id).maybeSingle();
      return jsonResp(200, {
        ok: true, job_id: job.id,
        protocolo_externo: updated?.protocolo_externo ?? null,
        status_externo: updated?.status_externo ?? "ENVIADO",
      });
    }

    // action === "fetch"
    if (!exame.protocolo_externo) {
      return jsonResp(400, { ok: false, error: "Exame ainda não foi enviado" });
    }
    const idempotencyKey = `POLL_RESULT:${exame.id}:${exame.protocolo_externo}`;
    const { data: job, error: jobErr } = await admin
      .from("integration_jobs")
      .insert({
        tenant_id: exame.tenant_id,
        integration_id: integrationId,
        kind: "POLL_RESULT",
        status: "PENDING",
        payload: { atendimento_exame_id: exame.id, external_protocol: exame.protocolo_externo },
        idempotency_key: idempotencyKey,
        scheduled_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobErr || !job) {
      if (jobErr?.code === "23505") {
        const { data: existing } = await admin
          .from("integration_jobs")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .order("created_at", { ascending: false })
          .limit(1).maybeSingle();
        if (existing) {
          try { await admin.functions.invoke("integration-dispatch", { body: { job_id: existing.id } }); } catch (_) {}
          return jsonResp(200, { ok: true, job_id: existing.id, status_externo: exame.status_externo, idempotent: true });
        }
      }
      return jsonResp(500, { ok: false, error: jobErr?.message ?? "enqueue_failed" });
    }
    try { await admin.functions.invoke("integration-dispatch", { body: { job_id: job.id } }); }
    catch (e) { console.warn("[lab-apoio-adapter] dispatch async falhou; runner pegará:", e); }
    const { data: updated } = await admin
      .from("atendimento_exames")
      .select("status_externo")
      .eq("id", exame.id).maybeSingle();
    return jsonResp(200, {
      ok: true, job_id: job.id, status_externo: updated?.status_externo ?? exame.status_externo,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[lab-apoio-adapter] erro:", msg);
    return jsonResp(500, { ok: false, error: msg });
  }
});