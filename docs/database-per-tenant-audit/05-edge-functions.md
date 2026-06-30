# 05 — Edge Functions

Todas as ~70 edge functions:
- Leem `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` do env do projeto único.
- Criam `createClient(SUPABASE_URL, KEY)` no início do handler.
- Acessam tabelas pelo client Supabase (PostgREST) — não pelo `pg` driver.

Exemplos verificados: `super-admin-create-tenant`, `dbsync-test-connection`, `super-admin-test-tenant-db`, `leads-manager`, `sign-resultado`, `whatsapp-webhook`, `create-atendimento`, …

Consequência: mesmo que `tenant_registry.db_host` aponte para outro Postgres, **nenhuma edge function escreve nesse banco**. Continua tudo no projeto shared.

Funcionariam em 500 projetos Supabase diferentes? **NÃO.** Seria necessário:
1. Deploy individual das funções em cada projeto, OU
2. Refatoração para escolher `createClient` por tenant + token cross-project, OU
3. Adoção de `pg`-driver direto em todos os caminhos críticos.
