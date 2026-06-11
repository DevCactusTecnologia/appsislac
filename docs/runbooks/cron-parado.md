# Runbook — Cron parado

Aplica-se aos 4 jobs ativos no `pg_cron` (ver `mem://architecture/cron-jobs`):

- `lab-apoio-cron-fetch-every-5min` (*/5 min)
- `integration-poll-results-every-minute` (1 min)
- `integration-jobs-runner-every-minute` (1 min)
- `provider-health-aggregator-1min` (1 min)

## 1. Sintomas

- Alerta "no cron_health rows" para um `job_name` nas últimas N janelas.
- Resultados de integração param de chegar; filas (`integration_jobs`) crescem.
- `provider_health_*` parado no tempo.
- Reclamação de usuário: "lab de apoio não puxou o último resultado".

## 2. Diagnóstico

### 2.1 Última execução de cada job (telemetria oficial)

```sql
select job_name, max(started_at) as last_run,
       count(*) filter (where started_at > now() - interval '15 minutes') as runs_15m,
       count(*) filter (where status='error' and started_at > now() - interval '1 hour') as err_1h
  from public.cron_health
 group by job_name
 order by last_run desc nulls last;
```

Esperado: `runs_15m >= 14` para jobs de 1 min e `>= 2` para o de 5 min.

### 2.2 Estado dos jobs no agendador

```sql
select jobid, jobname, schedule, active
  from cron.job
 order by jobid;
```

`active=false` → job foi desabilitado.

### 2.3 Resposta HTTP do último disparo

```sql
select id, status_code, content, created
  from net._http_response
 order by id desc
 limit 20;
```

- `401` → vault perdeu `cron_secret` ou drift com env `CRON_SECRET` da edge.
- `5xx` → erro na edge function; abrir logs.
- Sem linhas recentes → `pg_cron` não está disparando (DB pausado?).

## 3. Mitigação

### 3.1 Re-bootstrap do `cron_secret` (caso `401`)

1. Logar como `super_admin`.
2. Chamar a edge function `bootstrap-cron-secret` (botão na UI super_admin
   ou `curl` autenticado).
3. Verificar:

```sql
select name, created_at from vault.decrypted_secrets where name='cron_secret';
```

4. Disparar manualmente um ciclo do job afetado para validar:

```sql
select cron.schedule_in_database(
  jobname  => 'lab-apoio-cron-fetch-every-5min',
  schedule => '*/5 * * * *',
  command  => (select command from cron.job where jobname='lab-apoio-cron-fetch-every-5min'),
  database => current_database(),
  active   => true
);
```

### 3.2 Reativar job desabilitado

```sql
select cron.alter_job(jobid := <id>, active := true);
```

### 3.3 Edge function com erro

- Abrir **Cloud → Edge Functions → <nome> → Logs**.
- Procurar stack trace e `[cronHealth]` warnings.
- Se a regressão veio de deploy recente, ver `rollback.md`.

## 4. Correção definitiva

- Drift de `cron_secret`: documentar no incidente e adicionar item à
  checklist de rotação de secrets.
- Edge function: corrigir bug, abrir PR, validar via `bun run ci`, deploy.
- Ajuste de schedule: editar via `supabase--insert` (nunca em migration —
  ver `mem://architecture/cron-jobs`).

## 5. Pós-mortem

- Registrar janela do incidente (start/end UTC).
- Anexar query `cron_health` provando recuperação.
- Atualizar `mem://architecture/cron-jobs` se alterou schedule/auth.