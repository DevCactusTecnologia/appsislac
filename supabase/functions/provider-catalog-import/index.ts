/**
 * provider-catalog-import — enfileira a importação do XLSX e processa em
 * background via EdgeRuntime.waitUntil para evitar WORKER_RESOURCE_LIMIT
 * em planilhas grandes.
 *
 * Body: { provider, storage_path, integration_id? }
 * Retorna IMEDIATAMENTE { ok, job_id } e o frontend acompanha o status
 * pela tabela `provider_catalog_import_jobs`.
 */

// @ts-ignore deno
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore deno
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Row = Record<string, unknown>;

interface ParsedExam {
  code: string;
  name: string;
  alias: string | null;
  metodologia: string | null;
  material: string | null;
  payload_raw: Row;
  params: Map<string, ParsedParam>;
}
interface ParsedParam {
  sequencia: number;
  codigo: string | null;
  nome: string;
  unidade: string | null;
  decimais: number | null;
  tipo: string | null;
  possui_vr: boolean;
  refs: ParsedRef[];
}
interface ParsedRef {
  sexo: string | null;
  idade_inferior: string | null;
  idade_superior: string | null;
  valor_referencia: string | null;
}

function s(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const t = String(v).trim();
  return t === "" || t === "*" ? null : t;
}
function n(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

// deno-lint-ignore no-explicit-any
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: udata } = await userClient.auth.getUser();
    const user = udata?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    // tenant + permissão
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const tenant_id = (profile as { tenant_id?: string } | null)?.tenant_id ?? null;

    const { data: isSA } = await admin.rpc("is_super_admin", { _user_id: user.id });
    const { data: hasPerm } = await admin.rpc("has_permission", {
      _user_id: user.id,
      _permission: "integracoes.gerenciar",
    });
    if (!isSA && !hasPerm) return json({ error: "forbidden" }, 403);
    if (!tenant_id && !isSA) return json({ error: "no_tenant" }, 403);

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider ?? "").trim();
    const storage_path = String(body?.storage_path ?? "").trim();
    let integration_id: string | null = body?.integration_id ?? null;
    if (!provider || !storage_path) {
      return json({ error: "missing_fields" }, 400);
    }

    // Garante uma integration row para vincular o catálogo importado.
    if (!integration_id) {
      const { data: existing } = await admin
        .from("integrations")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("provider", provider)
        .maybeSingle();
      if (existing?.id) {
        integration_id = existing.id;
      } else {
        const { data: created, error: createErr } = await admin
          .from("integrations")
          .insert({
            tenant_id,
            provider,
            mode: "MOCK",
            ativo: false,
            config: { auto_created_for: "catalog_import" },
          })
          .select("id")
          .single();
        if (createErr) throw createErr;
        integration_id = created.id;
      }
    }

    // Cria job e dispara background.
    const { data: jobRow, error: jobErr } = await admin
      .from("provider_catalog_import_jobs")
      .insert({
        tenant_id,
        integration_id,
        provider,
        storage_path,
        status: "queued",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (jobErr) throw jobErr;
    const job_id = (jobRow as { id: string }).id;

    // @ts-ignore EdgeRuntime global
    EdgeRuntime.waitUntil(
      runImport(admin, {
        job_id,
        tenant_id: tenant_id as string,
        integration_id: integration_id as string,
        provider,
        storage_path,
      }).catch(async (e) => {
        await admin.from("provider_catalog_import_jobs").update({
          status: "failed",
          message: String((e as Error).message ?? e),
          finished_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);
      }),
    );

    return json({ ok: true, job_id, integration_id });
  } catch (e) {
    return json({ error: "internal", message: String((e as Error).message ?? e) }, 500);
  }
});

async function runImport(
  admin: ReturnType<typeof createClient>,
  args: {
    job_id: string;
    tenant_id: string;
    integration_id: string;
    provider: string;
    storage_path: string;
  },
) {
  const { job_id, tenant_id, integration_id, provider, storage_path } = args;
  await admin.from("provider_catalog_import_jobs").update({
    status: "processing",
    progress: 1,
    updated_at: new Date().toISOString(),
  }).eq("id", job_id);

  const { data: file, error: dlErr } = await admin
    .storage
    .from("provider-catalog-imports")
    .download(storage_path);
  if (dlErr || !file) throw new Error(dlErr?.message ?? "download_failed");
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true });

  const exams = new Map<string, ParsedExam>();
  for (const r of rows) {
      const code = s(r["CD_EXAME"]);
      if (!code) continue;
      let ex = exams.get(code);
      if (!ex) {
        ex = {
          code,
          name: s(r["DS_EXAME"]) ?? code,
          alias: s(r["SINONIMO"]),
          metodologia: s(r["METODOLOGIA"]),
          material: s(r["MATERIAL"]),
          payload_raw: {
            volume_obrigatorio: r["VOLUME_OBRIGATORIO"] ?? null,
            altura_obrigatorio: r["ALTURA_OBRIGATORIO"] ?? null,
            peso_obrigatorio: r["PESO_OBRIGATORIO"] ?? null,
            data_alteracao_laudo: r["DATA_ALTERACAO_LAUDO"] ?? null,
          },
          params: new Map(),
        };
        exams.set(code, ex);
      }
      const seq = n(r["SEQUENCIA"]) ?? 1;
      const pcode = s(r["CD_PARAMETRO"]);
      const pkey = `${seq}|${pcode ?? ""}`;
      let p = ex.params.get(pkey);
      if (!p) {
        p = {
          sequencia: seq,
          codigo: pcode,
          nome: s(r["DS_PARAMETRO"]) ?? pcode ?? "—",
          unidade: s(r["UNIDADE"]),
          decimais: n(r["DECIMAL"]),
          tipo: s(r["TIPO"]),
          possui_vr: String(r["POSSUI_VR"] ?? "").toUpperCase() === "S",
          refs: [],
        };
        ex.params.set(pkey, p);
      }
      const vr = s(r["VALORREFERENCIA"]);
      if (vr) {
        p.refs.push({
          sexo: s(r["SEXO"]),
          idade_inferior: s(r["IDADE_INFERIOR"]),
          idade_superior: s(r["IDADE_SUPERIOR"]),
          valor_referencia: vr,
        });
      }
    }

    await admin.from("provider_catalog_import_jobs").update({
      total_rows: rows.length,
      total_exams: exams.size,
      progress: 10,
      updated_at: new Date().toISOString(),
    }).eq("id", job_id);

    // UPSERT em batches
    let createdOrUpdated = 0;
    const errors: Array<{ code: string; message: string }> = [];
    const examList = Array.from(exams.values());
    const BATCH = 200;

    for (let i = 0; i < examList.length; i += BATCH) {
      const slice = examList.slice(i, i + BATCH);
      const upserts = slice.map((e) => ({
        tenant_id,
        integration_id,
        provider,
        provider_exam_code: e.code,
        provider_exam_name: e.name,
        provider_exam_alias: e.alias,
        material: e.material,
        metodologia: e.metodologia,
        payload_raw: e.payload_raw,
        ativo: true,
      }));
      const { data: upserted, error: upErr } = await admin
        .from("integration_provider_exams")
        .upsert(upserts, { onConflict: "tenant_id,provider,provider_exam_code" })
        .select("id, provider_exam_code");
      if (upErr) {
        errors.push({ code: "(batch)", message: upErr.message });
        continue;
      }
      const idByCode = new Map<string, string>();
      for (const u of upserted ?? []) idByCode.set((u as { provider_exam_code: string }).provider_exam_code, (u as { id: string }).id);
      createdOrUpdated += upserted?.length ?? 0;

      // Reescreve params + refs por exam (mais simples que diff): apaga e recria.
      const examIds = Array.from(idByCode.values());
      if (examIds.length) {
        await admin.from("integration_provider_exam_params").delete().in("provider_exam_id", examIds);
      }
      const paramRows: Array<Record<string, unknown>> = [];
      const paramByKey = new Map<string, ParsedParam>();
      for (const ex of slice) {
        const peId = idByCode.get(ex.code);
        if (!peId) continue;
        for (const p of ex.params.values()) {
          paramRows.push({
            tenant_id,
            provider_exam_id: peId,
            sequencia: p.sequencia,
            codigo: p.codigo,
            nome: p.nome,
            unidade: p.unidade,
            decimais: p.decimais,
            tipo: p.tipo,
            possui_vr: p.possui_vr,
          });
          paramByKey.set(`${peId}|${p.sequencia}|${p.codigo ?? ""}`, p);
        }
      }
      if (paramRows.length) {
        const { data: insertedParams, error: pErr } = await admin
          .from("integration_provider_exam_params")
          .insert(paramRows)
          .select("id, provider_exam_id, sequencia, codigo");
        if (pErr) {
          errors.push({ code: "(params)", message: pErr.message });
        } else {
          const refRows: Array<Record<string, unknown>> = [];
          for (const ip of insertedParams ?? []) {
            const row = ip as { id: string; provider_exam_id: string; sequencia: number; codigo: string | null };
            const p = paramByKey.get(`${row.provider_exam_id}|${row.sequencia}|${row.codigo ?? ""}`);
            if (!p) continue;
            for (const ref of p.refs) {
              refRows.push({
                tenant_id,
                param_id: row.id,
                sexo: ref.sexo,
                idade_inferior: ref.idade_inferior,
                idade_superior: ref.idade_superior,
                valor_referencia: ref.valor_referencia,
              });
            }
          }
          if (refRows.length) {
            // refs pode passar de 10k por batch; quebrar
            for (let j = 0; j < refRows.length; j += 1000) {
              const { error: rErr } = await admin
                .from("integration_provider_exam_refs")
                .insert(refRows.slice(j, j + 1000));
              if (rErr) errors.push({ code: "(refs)", message: rErr.message });
            }
          }
        }
      }

      const pct = 10 + Math.round(((i + slice.length) / Math.max(examList.length, 1)) * 88);
      await admin.from("provider_catalog_import_jobs").update({
        processed: createdOrUpdated,
        progress: Math.min(pct, 98),
        errors: errors.slice(0, 50),
        updated_at: new Date().toISOString(),
      }).eq("id", job_id);
    }

  await admin.from("provider_catalog_import_jobs").update({
    status: errors.length === 0 ? "done" : "failed",
    progress: 100,
    processed: createdOrUpdated,
    errors: errors.slice(0, 50),
    finished_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message: errors.length === 0 ? null : `${errors.length} erro(s)`,
  }).eq("id", job_id);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}