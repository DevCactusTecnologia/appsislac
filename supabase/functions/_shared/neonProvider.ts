// ════════════════════════════════════════════════════════════════════════
// Onda 2 — Neon provider client (DRY-RUN ONLY).
//
// Wrapper minimalista para a Neon Management API (https://neon.tech/docs/api).
// Em DRY-RUN: NÃO faz nenhuma chamada de rede e retorna uma resposta
// determinística, marcada com `dryRun: true`. Em modo real (Onda 2.5+),
// substitua os retornos por `fetch` autenticado com `NEON_API_KEY`.
//
// Regras:
//   - Nunca logar `NEON_API_KEY` nem senhas geradas.
//   - Idempotência por `idempotency_key` = `tenant_id`.
//   - Falhas sobem como Error com mensagem clara — caller decide rollback.
// ════════════════════════════════════════════════════════════════════════

export interface NeonProvisionInput {
  tenant_id: string;
  slug: string;
  region?: string; // ex: 'aws-us-east-2'
  dryRun: boolean;
}

export interface NeonProvisionResult {
  dryRun: boolean;
  provider: 'neon';
  project_id: string;
  branch_id: string;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_region: string;
  // Secret bruto NUNCA é persistido — só a referência opaca.
  db_secret_ref: string;
}

const NEON_API = 'https://console.neon.tech/api/v2';

function genSecretRef(tenant_id: string): string {
  // Em modo real, isto seria a chave no Vault/Secret Manager.
  return `vault://tenants/${tenant_id}/db_url`;
}

export async function neonCreateProject(input: NeonProvisionInput): Promise<NeonProvisionResult> {
  const region = input.region ?? 'aws-us-east-2';
  const projectName = `sislac-${input.slug}-${input.tenant_id.slice(0, 8)}`;

  if (input.dryRun) {
    return {
      dryRun: true,
      provider: 'neon',
      project_id: `dryrun-proj-${input.tenant_id.slice(0, 8)}`,
      branch_id: `dryrun-br-main`,
      db_host: `${projectName}.${region}.aws.neon.tech`,
      db_port: 5432,
      db_name: 'sislac',
      db_user: `tenant_${input.tenant_id.replace(/-/g, '').slice(0, 12)}`,
      db_region: region,
      db_secret_ref: genSecretRef(input.tenant_id),
    };
  }

  // ── Modo real (NÃO ATIVADO NESTA ONDA) ─────────────────────────────
  const apiKey = Deno.env.get('NEON_API_KEY');
  if (!apiKey) throw new Error('neonCreateProject: NEON_API_KEY ausente');
  const res = await fetch(`${NEON_API}/projects`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: { name: projectName, region_id: region, pg_version: 16 },
    }),
  });
  if (!res.ok) {
    throw new Error(`neonCreateProject: HTTP ${res.status} — ${await res.text()}`);
  }
  const data = await res.json();
  return {
    dryRun: false,
    provider: 'neon',
    project_id: data.project.id,
    branch_id: data.branch.id,
    db_host: data.connection_uris[0].connection_parameters.host,
    db_port: 5432,
    db_name: data.databases[0].name,
    db_user: data.roles[0].name,
    db_region: region,
    db_secret_ref: genSecretRef(input.tenant_id),
  };
}

export interface NeonHealthResult {
  ok: boolean;
  latency_ms: number;
  detail?: string;
}

/** Healthcheck stub: no dry-run sempre retorna ok=true imediatamente. */
export async function neonHealthcheck(_db_host: string | null, dryRun: boolean): Promise<NeonHealthResult> {
  if (dryRun) return { ok: true, latency_ms: 0, detail: 'dry-run' };
  // Modo real: abriria conexão com `pg` driver Deno e faria SELECT 1.
  return { ok: false, latency_ms: 0, detail: 'real-healthcheck not implemented' };
}