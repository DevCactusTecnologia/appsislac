// ════════════════════════════════════════════════════════════════════════
// Edge function `tenant-healthcheck` — Onda 2.
//
// Roda healthcheck por tenant (ou para TODOS quando tenant_id omitido)
// e atualiza `tenant_registry.last_health_*`. Em shared_db, valida acesso
// ao próprio Supabase. Em isolated_db, em dry-run sempre retorna ok=true
// (real virá na Onda 2.5 com Neon driver).
//
// Chamável apenas por super_admin OU pelo cron (com X-Cron-Secret).
// ════════════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  jsonResponse, errorResponse, preflight, newRequestId, createLogger,
} from '../_shared/hardening.ts';
import { neonHealthcheck } from '../_shared/neonProvider.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return preflight();
  const requestId = newRequestId(req);
  const log = createLogger('tenant-healthcheck', requestId);
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed', requestId, log);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY');
  const CRON_SECRET  = Deno.env.get('CRON_SECRET');
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return errorResponse(500, 'Server misconfiguration', requestId, log);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Auth: super_admin OU cron
  const cronHeader = req.headers.get('X-Cron-Secret');
  let authorized = false;
  if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) {
    authorized = true;
  } else {
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: isSuper } = await admin.rpc('is_super_admin', { _user_id: user.id });
      authorized = !!isSuper;
    }
  }
  if (!authorized) return errorResponse(403, 'forbidden', requestId, log);

  let body: { tenant_id?: string } = {};
  try { body = await req.json(); } catch { /* ok — sem body = todos */ }

  const q = admin.from('tenant_registry')
    .select('tenant_id, slug, runtime_mode, db_host, db_provider');
  const { data: rows, error } = body.tenant_id
    ? await q.eq('tenant_id', body.tenant_id)
    : await q;
  if (error) return errorResponse(500, error.message, requestId, log);

  const results: Array<Record<string, unknown>> = [];
  for (const r of (rows ?? [])) {
    const t0 = Date.now();
    let ok = true; let detail: string | undefined;

    if (r.runtime_mode === 'isolated_db') {
      // dry-run sempre (Onda 2).
      const h = await neonHealthcheck(r.db_host, true);
      ok = h.ok; detail = h.detail;
    } else {
      // shared_db: ping leve no próprio control-plane.
      const { error: pingErr } = await admin.from('tenant_registry').select('tenant_id').limit(1);
      ok = !pingErr; detail = pingErr?.message;
    }
    const duration = Date.now() - t0;

    await admin.from('tenant_registry').update({
      last_health_check: new Date().toISOString(),
      last_health_duration_ms: duration,
      last_health_result: ok ? 'ok' : 'failed',
      last_health_failure: ok ? null : detail ?? 'unknown',
    }).eq('tenant_id', r.tenant_id);

    results.push({ tenant_id: r.tenant_id, slug: r.slug, ok, duration_ms: duration, detail });
  }

  return jsonResponse(200, { ok: true, checked: results.length, results }, requestId);
});