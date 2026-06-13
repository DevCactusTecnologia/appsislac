const { Client } = require('pg');
const fs = require('fs');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const OUTPUT = '/mnt/documents/backup_sislac.sql';

const client = new Client({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 5432,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
});

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (val instanceof Date) return "'" + val.toISOString() + "'";
  if (typeof val === 'object') {
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

async function main() {
  await client.connect();

  const out = [];
  out.push('-- SISLAC Backup SQL');
  out.push(`-- tenant_id: ${TENANT_ID}`);
  out.push(`-- generated_at: ${new Date().toISOString()}`);
  out.push('BEGIN;');
  out.push('SET session_replication_role = replica;');
  out.push('');

  const { rows: tables } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
  );

  console.log(`Total de tabelas: ${tables.length}`);

  for (const { tablename } of tables) {
    try {
      // Verifica se tem tenant_id
      const { rows: tenantCheck } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='tenant_id'`,
        [tablename]
      );
      const hasTenantId = tenantCheck.length > 0;

      // Pega colunas
      const { rows: cols } = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [tablename]
      );
      if (cols.length === 0) continue;

      const colNames = cols.map(c => `"${c.column_name}"`);
      const colList = colNames.join(', ');

      // Pega dados
      const whereClause = hasTenantId ? 'WHERE tenant_id = $1' : '';
      const params = hasTenantId ? [TENANT_ID] : [];
      const { rows: data } = await client.query(
        `SELECT ${colList} FROM public."${tablename}" ${whereClause}`,
        params
      );

      out.push(`\n-- =========================================`);
      out.push(`-- Tabela: ${tablename} (${data.length} linha(s))`);
      out.push(`-- =========================================`);

      if (data.length === 0) continue;

      for (const row of data) {
        const vals = cols.map(c => esc(row[c.column_name]));
        out.push(`INSERT INTO public."${tablename}" (${colList}) VALUES (${vals.join(', ')});`);
      }

      console.log(`  ✓ ${tablename}: ${data.length} linhas`);
    } catch (e) {
      console.error(`  ✗ Erro em ${tablename}:`, (e instanceof Error ? e.message : String(e)));
    }
  }

  out.push('\nSET session_replication_role = DEFAULT;');
  out.push('COMMIT;');

  fs.writeFileSync(OUTPUT, out.join('\n'), 'utf-8');
  console.log(`\nBackup salvo em: ${OUTPUT}`);
  console.log(`Tamanho: ${(fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(2)} MB`);

  await client.end();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
