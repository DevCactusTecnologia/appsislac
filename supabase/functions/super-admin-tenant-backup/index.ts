// Edge function: super-admin-tenant-backup
// Exporta um snapshot dos dados do tenant em três formatos:
//   - format=sql   → SQL com INSERTs, comprimido em gzip (.sql.gz) — backup oficial
//   - format=json  → snapshot JSON estruturado (exportação operacional)
//   - format=xlsx  → planilha XLSX, uma aba por tabela (exportação operacional)
// Para isolated_db retorna 409 — backup é gerenciado pelo provider externo.
// Acesso: apenas super_admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { errorResponse, preflight, newRequestId, createLogger } from "../_shared/hardening.ts";

const TENANT_TABLES = [
  "atendimentos", "atendimento_exames", "atendimento_pagamentos", "atendimento_audit",
  "pacientes", "profiles", "user_roles",
  "unidades", "convenios", "convenio_faturas", "convenio_fatura_itens",
  "exames_catalogo", "exame_parametros", "exame_layouts", "exame_pops",
  "tabela_preco_itens", "valores_referencia", "setores_laboratoriais",
  "documento_templates", "select_options",
  // Dicionários financeiros e motivos de cancelamento foram consolidados
  // em `select_options` (migrações C.1 + C.3, 2026-06-13).
  "financeiro_saidas",
  "recoletas", "recoletas_motivos",
  "mapas_trabalho", "mapa_exames", "amostras",
  "especialistas", "estoque_insumos", "estoque_lotes",
  "estoque_movimentacoes", "estoque_fornecedores",
  "orcamentos", "orcamento_exames", "labs_apoio",
  "tenant_lab_config", "tenant_pages", "tenant_settings_public",
  "tenant_whatsapp_config", "audit_logs", "soroteca" as never,
];

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildSql(meta: Record<string, unknown>, tables: Record<string, Array<Record<string, unknown>>>): string {
  const lines: string[] = [];
  lines.push(`-- SISLAC backup oficial`);
  lines.push(`-- tenant_id: ${meta.tenant_id}`);
  lines.push(`-- lab: ${meta.nome} (${meta.lab_code ?? meta.slug ?? "-"})`);
  lines.push(`-- generated_at: ${meta.generated_at}`);
  lines.push(`-- generated_by: ${meta.generated_by}`);
  lines.push(`-- schema: ${meta.schema_kind}  version: ${meta.version}`);
  lines.push(`BEGIN;`);
  lines.push(`SET session_replication_role = replica;`);
  for (const [table, rows] of Object.entries(tables)) {
    lines.push(`\n-- =========================================`);
    lines.push(`-- Tabela: ${table} (${rows.length} linha(s))`);
    lines.push(`-- =========================================`);
    if (rows.length === 0) continue;
    const cols = Object.keys(rows[0]);
    const colList = cols.map((c) => `"${c}"`).join(", ");
    for (const r of rows) {
      const vals = cols.map((c) => sqlLiteral(r[c])).join(", ");
      lines.push(`INSERT INTO public."${table}" (${colList}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
    }
  }
  lines.push(`\nSET session_replication_role = DEFAULT;`);
  lines.push(`COMMIT;`);
  return lines.join("\n");
}

async function gzip(input: string): Promise<Uint8Array> {
  const stream = new Blob([input]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function buildXlsx(meta: Record<string, unknown>, tables: Record<string, Array<Record<string, unknown>>>): Uint8Array {
  const wb = XLSX.utils.book_new();
  const metaRows = Object.entries(meta).map(([k, v]) => ({ campo: k, valor: typeof v === "object" ? JSON.stringify(v) : String(v ?? "") }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metaRows), "_meta");
  // Excel limita células de texto a 32.767 caracteres. Truncamos com sufixo
  // explícito para não estourar a serialização do XLSX.
  const EXCEL_CELL_MAX = 32767;
  const truncate = (s: string) =>
    s.length > EXCEL_CELL_MAX ? s.slice(0, EXCEL_CELL_MAX - 32) + "…[TRUNCADO PARA EXCEL]" : s;
  for (const [table, rows] of Object.entries(tables)) {
    const flat = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v === null || v === undefined) { o[k] = ""; continue; }
        if (typeof v === "object") { o[k] = truncate(JSON.stringify(v)); continue; }
        if (typeof v === "string") { o[k] = truncate(v); continue; }
        o[k] = v;
      }
      return o;
    });
    // Nome de aba limitado a 31 chars no Excel
    const sheetName = table.slice(0, 31);
    const ws = flat.length > 0 ? XLSX.utils.json_to_sheet(flat) : XLSX.utils.aoa_to_sheet([["(vazio)"]]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(out);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  const requestId = newRequestId(req);
  const log = createLogger("super-admin-tenant-backup", requestId);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) return errorResponse(500, "Server misconfiguration", requestId, log);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: { user: caller }, error: cErr } = await userClient.auth.getUser();
  if (cErr || !caller) return errorResponse(401, "Não autenticado", requestId, log);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: caller.id });
  if (!isSuper) return errorResponse(403, "Apenas super admins", requestId, log);

  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "";
  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  if (!tenantId) return errorResponse(400, "tenantId obrigatório", requestId, log);
  // Salvaguarda: tenantId precisa ser UUID válido — impede injeção e
  // qualquer chance de bypass de filtro via valor exótico.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(tenantId)) return errorResponse(400, "tenantId inválido", requestId, log);
  if (!["json", "sql", "xlsx"].includes(format)) return errorResponse(400, "format inválido (json|sql|xlsx)", requestId, log);

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, nome, slug, lab_code, database_strategy")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return errorResponse(404, "Tenant não encontrado", requestId, log);
  if (tenant.id !== tenantId) return errorResponse(500, "Inconsistência de tenant", requestId, log);

  const { data: reg } = await admin
    .from("tenant_registry")
    .select("runtime_mode")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (reg?.runtime_mode === "isolated_db") {
    return errorResponse(409, "Banco dedicado: backup gerenciado pelo provedor externo", requestId, log);
  }

  const meta: Record<string, unknown> = {
    tenant_id: tenant.id,
    nome: tenant.nome,
    slug: tenant.slug,
    lab_code: tenant.lab_code,
    generated_at: new Date().toISOString(),
    generated_by: caller.email ?? caller.id,
    schema_kind: "shared_db",
    version: 1,
  };

  const tables: Record<string, Array<Record<string, unknown>>> = {};
  const counts: Record<string, number> = {};
  for (const table of TENANT_TABLES) {
    try {
      // 1) Filtro server-side por tenant_id na própria query.
      const { data, error } = await admin
        .from(table as string)
        .select("*")
        .eq("tenant_id", tenantId);
      if (error) {
        // Tabela sem coluna tenant_id (42703) ou outro erro: descartamos
        // a tabela inteira em vez de incluir linhas não-escopadas.
        log.warn(`skip ${table}`, { err: error.message, code: (error as { code?: string }).code });
        continue;
      }
      // 2) Defesa em profundidade: revalida cada linha em memória.
      //    Qualquer linha sem tenant_id ou com tenant_id divergente aborta o backup.
      const rawRows = (data ?? []) as Array<Record<string, unknown>>;
      const safeRows: Array<Record<string, unknown>> = [];
      let leaked = 0;
      for (const r of rawRows) {
        if (r.tenant_id !== tenantId) { leaked++; continue; }
        safeRows.push(r);
      }
      if (leaked > 0) {
        log.error(`tenant leak em ${table}`, { tenantId, leaked });
        return errorResponse(500, `Falha de integridade: vazamento cross-tenant em ${table}`, requestId, log);
      }
      tables[table] = safeRows;
      counts[table] = safeRows.length;
    } catch (e) {
      log.warn(`exception ${table}`, { err: e instanceof Error ? e.message : String(e) });
    }
  }
  meta.counts = counts;
  meta.tenant_scope_enforced = true;

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `backup_${tenant.lab_code ?? tenant.slug ?? tenantId}_${stamp}`;

  const corsBase = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Disposition",
    "X-Request-Id": requestId,
  };

  if (format === "sql") {
    const sql = buildSql(meta, tables);
    const gz = await gzip(sql);
    log.info("backup sql.gz", { tenantId, bytes: gz.byteLength });
    return new Response(gz, {
      status: 200,
      headers: {
        ...corsBase,
        "Content-Type": "application/gzip",
        "Content-Disposition": `attachment; filename="${base}.sql.gz"`,
      },
    });
  }

  if (format === "xlsx") {
    const xlsx = buildXlsx(meta, tables);
    log.info("backup xlsx", { tenantId, bytes: xlsx.byteLength });
    return new Response(xlsx, {
      status: 200,
      headers: {
        ...corsBase,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  const body = JSON.stringify({ meta, tables }, null, 2);
  log.info("backup json", { tenantId });
  return new Response(body, {
    status: 200,
    headers: {
      ...corsBase,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.json"`,
    },
  });
});
