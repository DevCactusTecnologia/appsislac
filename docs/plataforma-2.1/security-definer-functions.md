# Plataforma 2.1 — Fase 2: SECURITY DEFINER Functions / search_path

## Diagnóstico real

A auditoria 2.0 estimou ~50 funções sem `search_path`. A consulta direta ao catálogo (`pg_proc.proconfig`) revelou apenas **1** função sem `search_path` em todo o schema `public`:

| Função | Tipo | Status anterior | Ação |
|--------|------|-----------------|------|
| `whatsapp_outbox_touch()` | trigger | sem `search_path` | `SET search_path = public` |

> A estimativa de 50 incluía warnings de **outra natureza** (Public/Signed-In can Execute SECURITY DEFINER — tratado na Fase 3), não search_path mutável.

## Ação

```sql
ALTER FUNCTION public.whatsapp_outbox_touch() SET search_path = public;
```

## Verificação pós-migration

```sql
SELECT count(*) FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.prokind='f'
  AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'));
-- → 0
```

## Resultado

- **100 % das funções `public.*` têm `search_path` fixo.**
- 1 WARN `0011_function_search_path_mutable` eliminado.
- Zero impacto em runtime.
