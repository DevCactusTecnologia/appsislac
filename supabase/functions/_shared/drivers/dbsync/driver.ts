// DBSyncDriver — fachada server-side para DB Diagnósticos (DBSync SOAP).
// Reutiliza envelopes/parsers de _shared/protocols/dbsync.ts.

import {
  createDBSyncTransport,
  envelopeRecebeAtendimento as dbEnvRecebe,
  envelopeConsultaStatus as dbEnvStatus,
  envelopeConsultaLaudoPdf as dbEnvPdf,
  envelopeListaPendentes as dbEnvPend,
  envelopeConsultaRastreabilidade as dbEnvTrace,
  envelopeConsultaEtiqueta as dbEnvLabel,
  parseRecebeAtendimento as dbParseRecebe,
  parseConsultaStatus as dbParseStatus,
  parseConsultaLaudoPdf as dbParsePdf,
  parseListaPendentes as dbParsePend,
  parseConsultaRastreabilidade as dbParseTrace,
  parseConsultaEtiqueta as dbParseLabel,
} from "../../protocols/dbsync.ts";
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
  fetch_label: true,
  cancel_exam: false,
  cancel_sample: false,
  webhook: false,
};

export const DBSyncDriver: ProviderDriver = {
  provider: "DB_DIAGNOSTICOS",
  capabilities: CAPS,

  async dispatch(ctx: DriverContext): Promise<DriverOutcome> {
    const { admin, job, integration, tenant_id, integration_id, payload, externalProtocol, credentials } = ctx;
    const mode = (integration.mode as "MOCK" | "HOMOLOG" | "PROD") ?? "MOCK";
    const usuario = credentials.username;
    const chave = credentials.password;
    const transport = createDBSyncTransport({
      mode, endpoint: integration.endpoint_url ?? "",
      timeoutMs: ((integration.timeout_seconds as number) ?? 60) * 1000,
    });
    const baseI = { externalProtocol, usuario, chave };

    if (job.kind === "SEND_ORDER") {
      const aeId = payload.atendimento_exame_id as number | undefined;
      if (!aeId) return { kind: "fail", reason: "missing_atendimento_exame_id" };

      // Resolução unificada do código apoio (#13 do plano)
      let examesPayload: Array<{ codigoExame: string; material?: string }> = [];
      if (Array.isArray(payload.exames) && payload.exames.length > 0) {
        examesPayload = payload.exames as Array<{ codigoExame: string; material?: string }>;
      } else if (payload.exame_id != null) {
        const resolved = await resolveExamIntegrationConfig(admin, {
          tenantId: tenant_id, integrationId: integration_id,
          exameSislacId: payload.exame_id as string | number,
        });
        if (resolved.codigoApoio) {
          examesPayload = [{ codigoExame: resolved.codigoApoio, material: resolved.materialOverride ?? undefined }];
          await logIntegration(admin, {
            tenant_id, integration_id, job_id: job.id, level: "INFO",
            message: "DBSync: resolução do código de exame para apoio",
            context: { source: resolved.source, codigoApoio: resolved.codigoApoio, correlation_id: ctx.correlationId },
          });
        }
      }
      if (examesPayload.length === 0) {
        const fallback = String(payload.cod_exm_apoio ?? "").trim();
        if (fallback) examesPayload = [{ codigoExame: fallback }];
      }
      if (examesPayload.length === 0) return { kind: "fail", reason: "exam_code_unresolved" };

      const env = dbEnvRecebe({ ...baseI, exames: examesPayload });
      const r = await transport.request(env);
      const p = dbParseRecebe(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "RecebeAtendimento", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data?.aceito) {
        return { kind: "reschedule", reason: p.faultString ?? "envio_recusado" };
      }
      const protocolo = p.data.protocoloApoio ?? externalProtocol;
      const now = new Date().toISOString();
      await admin.from("atendimento_exames").update({
        status_externo: "ENVIADO", protocolo_externo: protocolo, data_envio: now,
      }).eq("id", aeId).eq("tenant_id", tenant_id);
      // Persiste provider_request_id para observabilidade
      await admin.from("integration_jobs").update({ provider_request_id: protocolo }).eq("id", job.id);
      return { kind: "completed", result: { protocolo_externo: protocolo, atendimento_exame_id: aeId } };
    }

    if (job.kind === "POLL_RESULT") {
      const env = dbEnvStatus(baseI);
      const r = await transport.request(env);
      const p = dbParseStatus(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "ConsultaStatusAtendimento", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data) return { kind: "fail", reason: p.faultString ?? "parse_error" };
      const out = p.data;
      await admin.from("integration_results").upsert({
        tenant_id, integration_id,
        atendimento_exame_id: payload.atendimento_exame_id ?? null,
        external_protocol: externalProtocol,
        status: out.statusGeralCanonical,
        resultado: out as unknown as Record<string, unknown>,
        liberado_em: out.statusGeralCanonical === "FINALIZADO" ? new Date().toISOString() : null,
      }, { onConflict: "integration_id,external_protocol" } as any);
      await admin.from("integration_sync_state").upsert({
        tenant_id, integration_id, scope: "RESULTS",
        last_sync_at: new Date().toISOString(),
        status: "OK", retries: 0, last_error: null,
      }, { onConflict: "integration_id,scope" } as any);
      return { kind: "completed", result: { exames: out.exames.length, status: out.statusGeralCanonical } };
    }

    if (job.kind === "FETCH_PDF") {
      const env = dbEnvPdf(baseI);
      const r = await transport.request(env);
      const p = dbParsePdf(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "ConsultaLaudoPDF", envelope: env, rawResponse: r.body,
        parsed: p.data ? { mimeType: p.data.mimeType, bytes: p.data.base64.length } : null,
        statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data?.base64) return { kind: "reschedule", reason: p.faultString ?? "pdf_unavailable" };
      const bin = Uint8Array.from(atob(p.data.base64), (c) => c.charCodeAt(0));
      const { data: lastResult } = await admin.from("integration_results")
        .select("id").eq("integration_id", integration_id)
        .eq("external_protocol", externalProtocol).order("created_at", { ascending: false })
        .limit(1).maybeSingle();
      const { data: tenantRow } = await admin.from("tenants").select("cnpj").eq("id", tenant_id).maybeSingle();
      const cnpj = (tenantRow?.cnpj as string | null) ?? "";
      const path = buildObjectKey({
        tenantId: tenant_id, cnpj, pacienteId: null, pacienteRef: null,
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
        tenant_id, paciente_id: null, paciente_ref: null,
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
      const env = dbEnvPend(baseI);
      const r = await transport.request(env);
      const p = dbParsePend(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "ListaProcedimentosPendentes", envelope: env, rawResponse: r.body,
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
      const env = dbEnvTrace(baseI);
      const r = await transport.request(env);
      const p = dbParseTrace(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "ConsultaRastreabilidade", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data) return { kind: "fail", reason: p.faultString ?? "parse_error" };
      await admin.from("integration_results").update({
        rastreabilidade: p.data.eventos as unknown as Record<string, unknown>,
      }).eq("integration_id", integration_id).eq("external_protocol", externalProtocol);
      return { kind: "completed", result: { eventos: p.data.eventos.length } };
    }

    if (job.kind === "FETCH_LABEL") {
      const env = dbEnvLabel(baseI);
      const r = await transport.request(env);
      const p = dbParseLabel(r.body);
      await persistRequestResponse(admin, {
        tenant_id, integration_id, job_id: job.id,
        method: "ConsultaEtiqueta", envelope: env, rawResponse: r.body,
        parsed: p.data ?? null, statusCode: r.status, durationMs: r.durationMs,
        parseError: p.ok ? null : (p.faultString ?? "parse_error"),
      });
      if (!p.ok || !p.data) return { kind: "fail", reason: p.faultString ?? "parse_error" };
      return { kind: "completed", result: p.data as unknown as Record<string, unknown> };
    }

    return { kind: "fail", reason: `kind_not_supported: ${job.kind}` };
  },
};
