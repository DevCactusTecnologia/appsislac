# 15 — Relatório Executivo

## 1. O SISLAC suporta hoje Database-per-Tenant?
**NÃO** (PARCIAL apenas em metadados). O código operacional usa um único projeto Supabase em build-time.

## 2. Percentual real de prontidão
**~18%** — apenas control-plane (tabela `tenant_registry`, UI de cadastro e teste de conexão Postgres direto).

## 3. O que impede produção
- Singleton `supabase` em `src/integrations/supabase/client.ts` carregado de `.env` em build-time.
- `resolveTenantConnection` lança erro para `dedicated` (`tenantConnection.ts:73-75`).
- Edge functions e Storage acoplados ao projeto shared.
- Auth/JWT único — incompatível com múltiplos projetos.
- Sem runner de migrations multi-banco.

## 4. Riscos
- SPOF do projeto shared (1 falha = todos os tenants caem).
- Falsa expectativa: a UI permite preencher host/porta/secret mas o app continua usando o banco shared. Risco regulatório (LGPD/RDC) por sugerir isolamento que não existe.
- Vazamento via cache global se alguém tentar “forçar” troca de tenant.
- Migrations divergentes caso alguém aplique manualmente no banco dedicado.

## 5. Pontos excelentes
- `tenant_registry` bem-modelado, com `db_provider`, `runtime_mode`, `runtime_status`.
- RLS multi-tenant consistente em todas as tabelas operacionais usando `current_tenant_id()` / `is_super_admin()`.
- Edge `super-admin-test-tenant-db` valida credenciais com `pg` real e retorna latência/versão.
- `neonProvider.ts` já tem contrato definido para a fase 2.5.
- Roadmap declarado em comentários (Ondas 1→4) com responsabilidades claras.

## 6. Pronto para 500 bancos independentes?
**Não.** Faltam: resolver de cliente Supabase per-tenant, Auth federada, Storage per-tenant, edge functions per-tenant, runner de migrations, observabilidade por banco.

## 7. Adicionar novo lab sem alterar código?
**Sim em `shared`, Não em `dedicated`.** Em shared basta criar o tenant; em dedicated o banco fica órfão (nenhum caminho de leitura/escrita o usa).

## 8. Arquitetura Enterprise?
**Não — Nível 1 (Protótipo)** segundo a classificação interna.

## 9. Top 10 riscos
1. SPOF do projeto Supabase único.
2. Falsa promessa de isolamento na UI (`TenantDatabaseConfig`).
3. JWT único impede federação.
4. Service-role compartilhada em todas as edge functions.
5. Storage de todos os tenants no mesmo bucket físico.
6. Migrations sem orquestração multi-banco → divergência.
7. Cache global no React (singleton client) impede troca dinâmica.
8. Realtime sem isolamento por projeto.
9. Sem failover/circuit-breaker no caminho do banco.
10. Compliance (LGPD/HDS-equivalente) prejudicado se o cliente acreditar em DB isolado.

## 10. O que corrigir antes de produção (resumo)
1. Extrair `supabase` para factory por tenant (`getSupabaseFor(tenantId)`).
2. Implementar resolver runtime (cache TTL + invalidação) baseado em `tenant_registry`.
3. Estratégia de Auth: federada (1 projeto auth central) OU SSO próprio + JWTs custom assinados.
4. Migrar de PostgREST puro para `pg` driver nos caminhos críticos quando `dedicated`.
5. Runner de migrations multi-banco com versionamento por tenant (`tenant_registry.schema_version`).
6. Storage namespaced por tenant + signed URLs por projeto.
7. Edge functions tenant-aware (resolver client por requisição).
8. Health-check por tenant + circuit-breaker.
9. Observabilidade (logs/metrics) com `tenant_id` em todos os eventos.
10. Plano de rollback per-tenant.

> **Conclusão**: o SISLAC tem o esqueleto de control-plane pronto (Onda 1) e nada de runtime (Ondas 2–4). Operar produção em DB-per-tenant requer implementação substancial — não é apenas configuração.
