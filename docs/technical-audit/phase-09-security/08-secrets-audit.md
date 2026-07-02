# 08 — Secrets Audit

## Mapeamento

### Frontend bundle (`src/`)
- `VITE_SUPABASE_URL` — público (URL do projeto)
- `VITE_SUPABASE_PUBLISHABLE_KEY` — anon JWT (público por design)
- **Nenhum segredo privado encontrado**. Grep de `service_role`/`eyJ` retorna apenas testes e strings de UI.

### Edge Functions env
- `SUPABASE_SERVICE_ROLE_KEY` — service-role (crítico). Server-only.
- `SUPABASE_ANON_KEY` — anon.
- `SB_SERVICE_ROLE_<ref>` — service-role por tenant dedicated.
- `<db_anon_key_ref>` — anon por tenant dedicated.
- HMAC (`_get_protocolo_hmac_key`).
- Tokens WhatsApp, PIX, provider integrations.

## Exposição
- `.env` no repo contém APENAS chaves publishable (correto).
- `src/integrations/supabase/client.ts` usa `import.meta.env.*` — build-time only.
- Nenhum `console.log(SERVICE_ROLE)` encontrado.

## Duplicação
- Cada edge chama `createClient(SUPABASE_URL, SERVICE_KEY)` no handler — não há singleton exportado. Aceitável (isolate ephemeral).

## Uso incorreto
- Não encontrado uso de service-role no frontend.
- Não encontrado fetch direto para service-role endpoint com anon.

## Governança
- `_shared/drivers/credentials.ts` cifra credenciais de integração antes de gravar em `integration_credentials`. Chave versionada.
- Rotação de `LOVABLE_API_KEY` disponível via tool dedicado (Lovable Cloud).
- Rotação de anon/service-role: manual, sem procedimento automatizado documentado.

## Achados
| # | Item | Severidade |
|---|---|---|
| SEC01 | Sem rotação automática de service-role | MÉDIO |
| SEC02 | Sem alerta em uso de service-role fora de allowlist | INFORMATIVO |
| SEC03 | `.env` apenas publishable — OK | INFORMATIVO |
