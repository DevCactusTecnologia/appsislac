# 06 — Auth

- `signInWithPassword`, `signUp`, refresh, sessão — todos em `src/contexts/AuthContext.tsx` (linhas 358, 455) contra o **único** projeto Supabase do `.env`.
- `validarCredenciaisAnalista.ts:64` abre client transiente, mesma URL.
- Convites, MFA, magic link, reset → também 1 projeto.

JWT issuer = projeto shared. Em DB-per-tenant real, cada projeto Supabase tem JWT secret diferente → o token do tenant A não valida no Postgres do tenant B. Não há ponte de federação.

Veredito: **incompatível com per-tenant** sem reescrita de toda a camada de Auth (federação, custom JWT, ou SSO central).
