# Coremas — Lições Aplicáveis ao SISLAC

> O Coremas é um monolito Laravel single-tenant funcionando há anos.
> Não é o destino do SISLAC, mas ensina **disciplina de simplicidade**.

---

## 1. O que copiar (com adaptação SaaS)

### 1.1 Status como Enum único
**Coremas:** `StatusEnum` + `Appointment::status()` accessor.
**SISLAC:** `src/lib/atendimentoStatus.ts` com `deriveAtendimentoStatus()` — único ponto de derivação.

### 1.2 Pipeline nomeado para operações compostas
**Coremas:** `store → save → check → finish → show → print` via `Pipeline`.
**SISLAC:** etapas nomeadas em `create_atendimento_tx`: `Validate → Price → Persist → Invoice → Audit → Notify`. Cada etapa é uma função pura testável.

### 1.3 Trait `new_parameter`
**Coremas:** centraliza máscara/obrigatório/crítico de cada parâmetro.
**SISLAC:** `ParameterRulesService.getParameterRules()` — SSOT de regras de input/validação/crítico.

### 1.4 Helpers únicos
**Coremas:** `Fill`, `Date`, `Sanitize` — toda formatação passa por aqui.
**SISLAC:** `src/lib/format.ts` + ESLint rule proibindo reimplementação.

### 1.5 Repositories explícitos
**Coremas:** `AppointmentRepository`, `ExamRepository` — controllers nunca acessam Eloquent direto.
**SISLAC:** `src/domains/<x>/repositories/` — services nunca importam supabase client direto.

### 1.6 Motivos como dicionário único
**Coremas:** `motives` + `MotiveEnum`.
**SISLAC:** consolidar `motivos_*` + `financeiro_*_pagamento` + `tipos_despesa` em `select_options`.

### 1.7 Traceability como tabela única
**Coremas:** `traceabilities` cobre cadeia de custódia clínica.
**SISLAC:** `operational_audit` unificada com `recurso_tipo` (substitui 7 tabelas atuais).

### 1.8 Layout de PDF modular
**Coremas:** `ContentPdf` trait + sub-traits para header/footer/body.
**SISLAC:** split de `comprovantes.ts` (1121 LOC) em `PdfService`, `QrService`, `VCardService`, `LegalTextService`.

---

## 2. O que NÃO copiar

| Pattern Coremas | Por quê rejeitar |
|---|---|
| Single-tenant hardcoded | Inviável para SaaS — Lovable já resolveu com `current_tenant_id()`. |
| `users.permissions` como TEXT | Privilege escalation — Lovable usa `user_roles` separado (correto). |
| `payment_apis.key/secret` plaintext | Lovable cifra com AES-GCM (P0 #1 resolvido). |
| `access_key` 8 chars sem rate-limit | Lovable tem `public_rate_limits` (P0 resolvido). |
| Template PDF único hardcoded | Lovable precisa `documento_templates` por tenant. |
| Sem RLS, sem RBAC | Inviável SaaS multi-tenant. |
| Sem realtime | Lovable precisa para coleta/análise simultânea. |
| Sentinel/Eloquent | Stack diferente; Supabase Auth é equivalente moderno. |

---

## 3. Princípio orientador

> **"O Coremas é simples porque resolve menos problemas."**
>
> O SISLAC resolve: multi-tenancy, RLS, RBAC, super admin, portal público, integrações terceirizadas, WhatsApp, billing, document engine, feature flags, branding por tenant.
>
> A meta não é virar Coremas. A meta é ter **a mesma disciplina de simplicidade dentro de cada domínio**, mantendo as capacidades SaaS.

---

## 4. Métrica final

| Indicador | Coremas | SISLAC hoje | SISLAC meta |
|---|---|---|---|
| Tabelas | 52 | ~95 | ~80 |
| Locais derivando status | 1 | 5+ | 1 |
| Locais com regra de parâmetro | 1 (trait) | 4+ | 1 (service) |
| Helpers formatação duplicados | 0 | N | 0 |
| Tabelas de auditoria | 2 | 10 | 2 |
| Tabelas de dicionário | 1 | 5 | 1 |
| Stores client-side | 0 | ~30 | ~18 |

---

## 5. Conclusão

Adotar as **8 lições copiáveis** corta ~25% da complexidade acidental do SISLAC sem tocar em:
- Multi-tenant
- RLS
- RBAC
- Portal
- WhatsApp
- Super Admin
- Integrações
- Regras clínicas
- Regras financeiras

O resultado é um SaaS que opera com **a clareza de um monolito** — sem deixar de ser SaaS.
