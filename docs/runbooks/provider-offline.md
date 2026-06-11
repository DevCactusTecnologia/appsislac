# Runbook — Provider offline

Provedores externos cobertos:

- **DBSync** (`src/integrations/providers/dbsync/`)
- **Hermes Pardini** (`src/integrations/providers/hermes-pardini/`)
- **Labs de apoio** genéricos (`lab-apoio-*` edge functions)

Telemetria oficial: tabela `provider_health_*` (agregada minuto a minuto
pela função `provider-health-aggregator`).

## 1. Sintomas

- `/super-admin` → painel de saúde com provedor em vermelho.
- `provider_health_current` mostra `last_success_at` defasado.
- Spike de `integration_jobs.status='error'` para um único `provider`.
- Usuários: "não estou conseguindo enviar para o lab X".

## 2. Diagnóstico

### 2.1 Saúde agregada

```sql
select provider, ok_count, err_count, last_success_at, last_error_at
  from public.provider_health_current
 order by last_success_at asc nulls first;
```

### 2.2 Últimos erros do provedor

```sql
select created_at, status, last_error, attempts
  from public.integration_jobs
 where provider = 'hermes-pardini'
   and created_at > now() - interval '30 minutes'
 order by created_at desc
 limit 50;
```

### 2.3 Teste de conectividade

- UI super_admin: **Integrações → Testar conexão** (`super-admin-test-integration`).
- Edge function `integration-test-connection` retorna o payload bruto do provedor.

## 3. Mitigação

### 3.1 Provedor confirmadamente offline

1. Comunicar tenants impactados (banner no super_admin).
2. **Pausar dispatch** do provedor para evitar saturar a fila:
   - via UI super_admin → Integrações → Provider → Pausar.
   - ou marcar `integration_configs.enabled=false` para o `provider` afetado
     (apenas super_admin via edge function — nunca UPDATE direto).
3. Manter `poll-results` ligado (continua tentando ler resultados pendentes).

### 3.2 Provedor instável (intermitente)

- Deixar dispatch ligado, confiar em retry exponencial (`integration_jobs.attempts`).
- Aumentar janela de monitoramento; só agir se err_pct > 50% por 10 min.

### 3.3 Credenciais expiradas

- `integration-save-credentials` (super_admin) renova o segredo no vault.
- Após renovar, re-testar com `integration-test-connection`.

## 4. Correção definitiva

- Ajustar adapter do provedor se mudou contrato (campos, encoding, auth).
- Adicionar caso de teste em `supabase/functions/_shared/drivers/*` ou
  no test do adapter relevante.
- Atualizar `mem://architecture/` se mudou capability matrix.

## 5. Pós-mortem

- Janela de indisponibilidade por tenant.
- Quantidade de jobs reprocessados via DLQ.
- Confirmar zerar fila de erro: `select count(*) from integration_jobs where status='error'`.