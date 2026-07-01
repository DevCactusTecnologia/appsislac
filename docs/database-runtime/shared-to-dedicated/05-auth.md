# 05 — Auth

## Estado atual

- **Auth 100% no projeto shared** — `AuthContext.tsx` chama `sharedClient.auth.signInWithPassword` diretamente.
- JWT emitido por um único GoTrue (projeto `xhaeozwdfjuvpxgguqqp`).
- `current_tenant_id()` (RPC/security definer no Postgres shared) lê `profiles.tenant_id` a partir de `auth.uid()`.

## Fluxo de login com tenant dedicated

1. Usuário faz login no shared (senha bate contra `auth.users` do shared).
2. Frontend chama `tenant-runtime-config` — retorna `{mode:"dedicated", dedicated:{url,anon_key}}`.
3. Frontend cria client dedicated com `persistSession:false` — **sem sessão no dedicated**.
4. `tenant-dedicated-login-gate` valida por Postgres direto se o usuário existe em `public.profiles` do banco dedicado.
5. Queries data-plane (allowlist) vão para o dedicated **anon** — logo, sujeitas apenas às policies que aceitem role `anon` OU `authenticated` sem exigir `auth.uid()` real do projeto dedicated.

## Problema estrutural (JWT mismatch)

O JWT emitido pelo projeto shared **não é válido** no PostgREST do projeto dedicated. Portanto:
- `auth.uid()` no banco dedicado retorna `NULL`.
- Qualquer policy que use `auth.uid() = ...` **falha** no dedicated.
- Policies precisariam ser reescritas para role `anon` com filtros por tenant embutidos em queries — o que quebra o modelo RLS atual.

Não há federação de JWT / custom-JWT signing entre projetos. Não há ponte SSO.

## Componentes por perfil

| Ator | Onde autentica | Onde lê dados | Estado Dedicated |
|---|---|---|---|
| Super Admin | Shared (Auth) | Shared (control-plane) | ✓ Não afetado |
| Admin/Manager/User de tenant Shared | Shared | Shared | ✓ Funciona |
| Admin/Manager/User de tenant Dedicated | Shared | Dedicated (anon, sem uid) | ✗ RLS quebra |

## Respostas objetivas

- **Dedicated funciona?** ✗ Não — sem JWT válido no projeto dedicated, RLS baseada em `auth.uid()` fica sem contexto.
- **Shared funciona?** ✓ Sim (estado normal do produto hoje).
- **Existe acoplamento?** ✓ Muito alto — `AuthContext`, `validarCredenciaisAnalista`, todos os edge functions e RLS assumem um único JWT issuer.
