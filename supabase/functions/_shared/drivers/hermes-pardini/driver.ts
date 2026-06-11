// HermesDriver — fachada server-side encapsulando a lógica que vivia
// inline em integration-dispatch. Não muda comportamento: reusa envelopes,
// parsers e transport existentes em _shared/protocols/hermes-pardini.ts.

import {
  createTransport,
  envelopeGetResultado,
  envelopeVerificarRecebimento,
  envelopeGetPendenciaTecnica,
  envelopeGetRastreabilidade,
  envelopeGetLaudoPdf,
  parseGetResultado,
  parseVerificarRecebimento,
  parseGetPendencia,
  parseGetRastreabilidade,
  parseGetLaudoPdf,
} from "../../protocols/hermes-pardini.ts";
import { logIntegration, persistRequestResponse } from "../../integrationLog.ts";
import { resolveExamIntegrationConfig } from "../../resolveExamIntegration.ts";
import {
  buildObjectKey,
  loadS3Config,
  recordStorageAudit,
  s3PutObject,
} from "../../s3.ts";
import type { DriverContext, DriverOutcome, ProviderDriver, ServerCapabilities } from "../types.ts";

const CAPS: ServerCapabilities = {
  send_order: true,
  polling: true,
  fetch_pdf: true,
  fetch_pending: true,
  fetch_trace: true,
  fetch_label: false,
  cancel_exam: false,
  cancel_sample: false,
  webhook: false,
};

export const HermesDriver: ProviderDriver = {
  provider: "HERMES_PARDINI",
  capabilities: CAPS,

  async dispatch(ctx: DriverContext): Promise<DriverOutcome> {
    const { admin, job, integration, tenant_id, integration_id, payload, externalProtocol, credentials } = ctx;
    const mode = (integration.mode as "MOCK" | "HOMOLOG" | "PROD") ?? "MOCK";
    const clientCode = String(integration.client_code ?? payload.client_code ?? "");
    const transport = createTransport(mode, {
      endpoint: integration.endpoint_url ?? "",
      username: undefined,
      password: undefined,
      timeoutMs: ((integration.timeout_seconds as number) ?? 60) * 1000,
      soapActionPrefix: integration.soap_action_prefix ?? undefined,
    });
    const cfg = (integration.config ?? {}) as Record<string, unknown>;
    const papelTimbrado = !!cfg.papel_timbrado;
    const valorReferencia: 0 | 1 = cfg.valor_referencia ? 1 : 0;
    const ano = (typeof payload.ano === "number") ? (payload.ano as number) : undefined;
    const baseAuth = { login: credentials.username || undefined, passwd: credentials.password || undefined, ano };

    if (job.kind === "POLL_RESULT") {
      const env1 = envelopeVerificarRecebimento({ clientCode, externalProtocol, ...baseAuth });
      const r1 = await transport.request(env1);
      const p1 = parseVerificarRecebimento(r1.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "verificarRecebimentoPedido", envelope: env1, rawResponse: r1.body,
        parsed: p1.data ?? null, statusCode: r1.status, durationMs: r1.durationMs,
        parseError: p1.ok ? null : (p1.faultString ?? "parse_error"),
      });
      if (!p1.ok || !p1.data?.recebido) {
        await logIntegration(admin, {
          tenant_id, integration_id, job_id: job.id, level: "INFO",
          message: "Pedido ainda não recebido pelo apoio; reagendado.",
          context: { externalProtocol, parsed: p1.data ?? null, correlation_id: ctx.correlationId },
        });
        return { kind: "reschedule", reason: "not_received_yet" };
      }
      let codExmApoio = typeof payload.cod_exm_apoio === "string" ? (payload.cod_exm_apoio as string) : "";
      if (!codExmApoio && payload.exame_id != null) {
        const resolved = await resolveExamIntegrationConfig(admin, {
          tenantId: tenant_id, integrationId: integration_id,
          exameSislacId: payload.exame_id as string | number,
        });
        codExmApoio = resolved.codigoApoio;
        await logIntegration(admin, {
          tenant_id, integration_id, job_id: job.id, level: "INFO",
          message: "Resolução do código de exame para apoio",
          context: { source: resolved.source, codigoApoio: resolved.codigoApoio, correlation_id: ctx.correlationId },
        });
      }
      const env2 = envelopeGetResultado({
        clientCode, externalProtocol, ...baseAuth,
        papelTimbrado, valorReferencia, codExmApoio, versaoResultado: 1,
      });
      const r2 = await transport.request(env2);
      const p2 = parseGetResultado(r2.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "getResultadoPedido", envelope: env2, rawResponse: r2.body,
        parsed: p2.data ?? null, statusCode: r2.status, durationMs: r2.durationMs,
        parseError: p2.ok ? null : (p2.faultString ?? "parse_error"),
      });
      if (!p2.ok || !p2.data) return { kind: "fail", reason: p2.faultString ?? "parse_error" };
      const out = p2.data;
      await admin.from("integration_results").upsert({
        tenant_id, integration_id,
        atendimento_exame_id: payload.atendimento_exame_id ?? null,
        external_protocol: out.externalProtocol || externalProtocol,
        status: out.status,
        resultado: out as unknown as Record<string, unknown>,
        liberado_em: out.dataLiberacao ?? null,
      }, { onConflict: "integration_id,external_protocol" } as any);
      await admin.from("integration_sync_state").upsert({
        tenant_id, integration_id, scope: "RESULTS",
        last_sync_at: new Date().toISOString(),
        last_result_date: out.dataLiberacao ?? new Date().toISOString(),
        status: "OK", retries: 0, last_error: null,
      }, { onConflict: "integration_id,scope" } as any);
      return { kind: "completed", result: { exames: out.exames.length, status: out.status } };
    }

    if (job.kind === "FETCH_PDF") {
      const env = envelopeGetLaudoPdf({ clientCode, externalProtocol, ...baseAuth });
      const r = await transport.request(env);
      const p = parseGetLaudoPdf(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "getLaudoPdf", envelope: env, rawResponse: r.body,
        parsed: p.data ? { mimeType: p.data.mimeType, bytes: p.data.base64.length } : null,
        statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data || !p.data.base64) {
        return { kind: "reschedule", reason: p.faultString ?? "pdf_unavailable" };
      }
      const bin = Uint8Array.from(atob(p.data.base64), (c) => c.charCodeAt(0));
      const { data: lastResult } = await admin
        .from("integration_results")
        .select("id, atendimento_exame_id")
        .eq("integration_id", integration_id)
        .eq("external_protocol", externalProtocol)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      let pacienteId: number | null = null;
      let pacienteCpf: string | null = null;
      if (lastResult?.atendimento_exame_id) {
        const { data: ae } = await admin.from("atendimento_exames")
          .select("atendimento_id").eq("id", lastResult.atendimento_exame_id).maybeSingle();
        if (ae?.atendimento_id) {
          const { data: at } = await admin.from("atendimentos")
            .select("paciente_id").eq("id", ae.atendimento_id).maybeSingle();
          if (at?.paciente_id) {
            pacienteId = Number(at.paciente_id);
            const { data: pac } = await admin.from("pacientes").select("cpf").eq("id", pacienteId).maybeSingle();
            pacienteCpf = (pac?.cpf as string | null) ?? null;
          }
        }
      }
      const { data: tenantRow } = await admin.from("tenants").select("cnpj").eq("id", tenant_id).maybeSingle();
      const cnpj = (tenantRow?.cnpj as string | null) ?? "";
      const path = buildObjectKey({
        tenantId: tenant_id, cnpj, pacienteId, pacienteRef: pacienteCpf,
        category: "laudos", filename: `${externalProtocol}.pdf`,
      });
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const s3 = await loadS3Config(SUPABASE_URL, SERVICE_KEY);
      let backend: "s3" | "supabase" = "supabase";
      let bucketName = "integration-assets";
      if (s3) {
        try { await s3PutObject(s3, path, bin, p.data.mimeType); backend = "s3"; bucketName = s3.bucket; }
        catch (e) { return { kind: "reschedule", reason: `s3_upload: ${e instanceof Error ? e.message : String(e)}` }; }
      } else {
        const up = await admin.storage.from("integration-assets").upload(path, bin, {
          contentType: p.data.mimeType, upsert: false,
        });
        if (up.error) return { kind: "reschedule", reason: `storage_upload: ${up.error.message}` };
      }
      await recordStorageAudit(SUPABASE_URL, SERVICE_KEY, {
        tenant_id, paciente_id: pacienteId, paciente_ref: pacienteCpf,
        category: "laudos", backend, bucket: bucketName, object_key: path,
        action: "upload", size_bytes: bin.byteLength, content_type: p.data.mimeType,
        metadata: { integration_id, external_protocol: externalProtocol, job_id: job.id, correlation_id: ctx.correlationId },
      });
      await admin.from("integration_pdfs").insert({
        tenant_id, integration_id, result_id: lastResult?.id ?? null,
        external_protocol: externalProtocol, kind: "LAUDO",
        storage_path: path, size_bytes: bin.byteLength, mime_type: p.data.mimeType,
      });
      return { kind: "completed", result: { storage_path: path, bytes: bin.byteLength, backend, bucket: bucketName } };
    }

    if (job.kind === "FETCH_PENDING") {
      const env = envelopeGetPendenciaTecnica({ clientCode, externalProtocol, ...baseAuth });
      const r = await transport.request(env);
      const p = parseGetPendencia(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "getPendenciaTecnica", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data) return { kind: "fail", reason: p.faultString ?? "parse_error" };
      await admin.from("integration_results").update({
        pendencias: p.data.pendencias as unknown as Record<string, unknown>,
      }).eq("integration_id", integration_id).eq("external_protocol", externalProtocol);
      return { kind: "completed", result: { pendencias: p.data.pendencias.length } };
    }

    if (job.kind === "FETCH_TRACE") {
      const env = envelopeGetRastreabilidade({ clientCode, externalProtocol, ...baseAuth });
      const r = await transport.request(env);
      const p = parseGetRastreabilidade(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "getRastreabilidade", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data) return { kind: "fail", reason: p.faultString ?? "parse_error" };
      await admin.from("integration_results").update({
        rastreabilidade: p.data.eventos as unknown as Record<string, unknown>,
      }).eq("integration_id", integration_id).eq("external_protocol", externalProtocol);
      return { kind: "completed", result: { eventos: p.data.eventos.length } };
    }

    if (job.kind === "SEND_ORDER") {
      const atendimentoExameId = payload.atendimento_exame_id as number | undefined;
      if (!atendimentoExameId) return { kind: "fail", reason: "missing_atendimento_exame_id" };
      let protocolo = externalProtocol;
      if (mode === "MOCK") {
        if (!protocolo) {
          const ts = Date.now().toString(36).toUpperCase();
          const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
          protocolo = `EXT-${ts}-${rnd}`;
        }
      } else {
        await logIntegration(admin, {
          tenant_id, integration_id, job_id: job.id, level: "ERROR",
          message: "SEND_ORDER em modo HOMOLOG/PROD ainda não implementado (Hermes mock-first).",
          context: { mode, correlation_id: ctx.correlationId },
        });
        return { kind: "fail", reason: `send_order_not_implemented_for_mode_${mode}` };
      }
      const now = new Date().toISOString();
      const { error: upErr } = await admin.from("atendimento_exames").update({
        status_externo: "ENVIADO", protocolo_externo: protocolo, data_envio: now,
      }).eq("id", atendimentoExameId).eq("tenant_id", tenant_id);
      if (upErr) return { kind: "reschedule", reason: `update_exame_failed: ${upErr.message}` };
      await logIntegration(admin, {
        tenant_id, integration_id, job_id: job.id, level: "INFO",
        message: "Pedido enviado (mock).",
        context: { protocolo, atendimento_exame_id: atendimentoExameId, correlation_id: ctx.correlationId },
      });
      return { kind: "completed", result: { protocolo_externo: protocolo, atendimento_exame_id: atendimentoExameId } };
    }

    return { kind: "fail", reason: `kind_not_supported: ${job.kind}` };
  },
};
