# SISLAC — Padrões Oficiais

> Toda nova tabela, policy, RPC, trigger e edge function DEVE seguir estes padrões. Desvios precisam de justificativa em PR.

## 1. Policy Pattern

```sql
-- SELECT
CREATE POLICY <tab>_select ON public.<tab>
  FOR SELECT TO authenticated
  USING (
    is_super_admin(auth.uid())
    OR (tenant_id = current_tenant_id()
        AND has_permission(auth.uid(), '<permissao>'))
  );

-- INSERT
CREATE POLICY <tab>_insert ON public.<tab>
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = current_tenant_id()
    AND has_permission(auth.uid(), '<permissao>')
  );

-- UPDATE
CREATE POLICY <tab>_update ON public.<tab>
  FOR UPDATE TO authenticated
  USING (<mesma condição>)
  WITH CHECK (<mesma condição>);

-- DELETE
CREATE POLICY <tab>_delete ON public.<tab>
  FOR DELETE TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND has_role(auth.uid(), 'admin')
  );
```

### Helper opcional (futuro)
```sql
CREATE OR REPLACE FUNCTION public.can_access_tenant_row(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT is_super_admin(auth.uid()) OR _tenant_id = current_tenant_id();
$$;
```
Uso futuro: `USING (can_access_tenant_row(tenant_id) AND has_permission(auth.uid(),'…'))`.

## 2. Audit Pattern

### Banco (trigger)
**Uma única trigger por tabela** usando `audit_trigger()` genérica. Tabelas com auditoria fina (atendimento) podem ter uma adicional específica, mas **NUNCA** as duas escrevendo no mesmo destino.

### Frontend / edge function
```ts
import { auditAction } from "@/lib/audit";
await auditAction({
  acao: "atendimento.finalizar",
  alvo_tipo: "atendimento",
  alvo_id: id,
  justificativa,                 // obrigatório pós-finalização
});
```

## 3. Tenant Pattern

### Server-side (SQL)
**Sempre** `current_tenant_id()`. **Nunca** subquery em `profiles` direto.

### Client-side (TS)
```ts
import { getTenantContext } from "@/lib/db/tenantResolver";
const { tenant_id, database_strategy } = await getTenantContext();
```
**Frontend nunca envia `tenant_id` para o servidor** — RLS resolve.

## 4. Permission Pattern

### SQL
```sql
has_permission(auth.uid(), 'visualizar_atendimentos')
has_role(auth.uid(), 'admin'::app_role)
is_super_admin(auth.uid())
```

### TS
```ts
import { requireRole, requirePermission } from "@/lib/auth";
await requireRole("admin");
await requirePermission("registrar_pagamento");
```

## 5. Trigger Pattern — `updated_at`

```sql
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_<tab>_updated_at
  BEFORE UPDATE ON public.<tab>
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
```
**Nunca** criar variante `touch_<tab>_updated_at` específica.

## 6. RPC Pattern

```sql
CREATE OR REPLACE FUNCTION public.<dominio>_<acao>_tx(<args>)
RETURNS <tipo>
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Validar tenant via current_tenant_id()
  -- 2. Validar permissão via has_permission/has_role
  -- 3. Executar dentro de transação
  -- 4. Auditar
END $$;

REVOKE EXECUTE ON FUNCTION public.<...> FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.<...> TO authenticated;
```

## 7. Edge Function Pattern

```ts
// supabase/functions/<nome>/index.ts
Deno.serve(async (req) => {
  // 1. CORS
  // 2. Auth: validar JWT manualmente (verify_jwt=false)
  // 3. Resolver tenant_id do JWT — nunca do body
  // 4. Validar permissão via RPC has_role/has_permission
  // 5. Executar
  // 6. Auditar
});
```

## 8. Tabela nova — checklist

- [ ] Coluna `tenant_id uuid NOT NULL` (operacional) OU justificar global
- [ ] `updated_at`, `created_at` com defaults
- [ ] `GRANT` apropriado (`authenticated`, `service_role`)
- [ ] `ENABLE ROW LEVEL SECURITY`
- [ ] 4 policies seguindo Policy Pattern
- [ ] Trigger `set_updated_at_timestamp()`
- [ ] Trigger `audit_trigger()` (se mutação for sensível)
- [ ] Documentar em `docs/governance/database-catalog.md`
- [ ] Classificar como Shared / Dedicated / SuperAdmin
