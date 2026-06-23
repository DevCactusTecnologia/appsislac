# Plataforma 2.0 — Fase 9: RLS e Segurança

## Cobertura RLS

- **116 tabelas em `public`**.
- **Todas têm RLS habilitada e ≥1 policy.** Lista de tabelas sem policy: **vazia**.
- **366 policies** no total — média de ~3,15 policies/tabela (típico: SELECT, INSERT, UPDATE/DELETE separadas).

## Padrão de isolamento

Toda tabela de domínio usa `current_tenant_id()` na cláusula `USING`/`WITH CHECK`:

```sql
USING (tenant_id = current_tenant_id() OR is_super_admin())
WITH CHECK (tenant_id = current_tenant_id() AND has_permission(auth.uid(), 'perm_x'))
```

Tabelas de plataforma (`tenants`, `subscription_plans`, `saas_settings`) usam `is_super_admin()` exclusivo.

## Bypass / pontos sensíveis

| Ponto | Risco | Avaliação |
|-------|-------|-----------|
| `is_super_admin()` (sem args) lê `auth.uid()` direto | Médio | Necessário para super-admin global; revalidado em edge functions `super-admin-*`. |
| 7 views `SECURITY DEFINER` (linter ERROR) | **Médio-Alto** | `convenio_competencia_resumo`, `convenio_fatura_resumo`, `exames_publicos_view`, `financeiro_entradas`, `platform_health_aggregate`, `provider_health_current`, e provavelmente `tenant_public` ou outra. Executam com privilégios do criador — bypass de RLS do chamador. **Documentado, não corrigido.** |
| ~50 funções SECURITY DEFINER sem `search_path` fixo (linter WARN) | Médio | Risco de schema-injection se um atacante criar objetos em schema do search_path. **Documentado.** |
| Algumas SECURITY DEFINER são EXECUTE PUBLIC (linter WARN) | Médio | Chamáveis sem login (ex.: lookup_paciente_publico, get_published_tenant_page) — propositadamente públicas para portal/landing; revisar lista completa. |

## Resumo do linter Supabase

| Severidade | Qtd |
|------------|----:|
| ERROR      | 7   (todas Security Definer View) |
| WARN       | ~166 (search_path mutável, public execute) |
| **Total**  | 173 |

## Policies órfãs / tabelas sem proteção

- **Policies órfãs:** nenhuma (todas em tabelas existentes).
- **Tabelas sem RLS:** **nenhuma**.
- **Tabelas sem policy mas com RLS habilitada:** **nenhuma**.

## Veredito de segurança
Postura sólida no operacional (RLS + tenant + roles + permission helpers). **Débito real:** 7 views SECURITY DEFINER + funções com `search_path` mutável — itens conhecidos, não corrigidos nesta fase por regra de parada.
