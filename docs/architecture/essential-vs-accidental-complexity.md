# Essential vs Accidental Complexity — SISLAC

> Classificação inspirada em Brooks (*No Silver Bullet*) e contrastada com Coremas (Laravel monolito single-tenant).

---

## 1. Complexidade Essencial (manter)

| Área | Por que é essencial |
|---|---|
| **Multi-tenant + RLS** | Modelo de negócio SaaS. Coremas não tem porque é single-tenant. |
| **RBAC granular** (`has_permission`, `has_role`, `is_super_admin`) | Compliance + boundary de plataforma. |
| **Tenant resolver server-side** (`current_tenant_id()`) | Anti-spoofing — frontend nunca confia em `tenant_id`. |
| **Super Admin via edge functions** (`super-admin-*` + service-role) | Operações cross-tenant exigem boundary fora do PostgREST. |
| **Portal do Paciente** (comprovantes, shortlinks, QR, hash FNV-1a) | Diferencial competitivo, requer hash determinístico para verificação pública. |
| **WhatsApp / Z-API** (idempotência, rate limit, audit) | Notificação assíncrona crítica. |
| **Integrações terceirizadas** (DBSync, Hermes-Pardini, circuit breaker) | Lab de apoio é commodity do setor. |
| **Auditoria operacional clínica** (`atendimento_audit`, críticos) | Compliance ANVISA/CFM. |
| **Realtime de atendimentos** (filtro tenant-scoped) | Coleta/análise simultânea exige convergência. |
| **Feature flags por tenant** | Rollout incremental obrigatório em SaaS. |
| **Document engine** (`documento_templates`, `laudoResolver`) | Customização por tenant — Coremas tem template único hardcoded. |

---

## 2. Complexidade Acidental (remover/consolidar)

### 2.1 Derivação de status espalhada
- **Onde:** `atendimentoStore`, `Resultados.tsx`, `Financeiro/helpers.ts`, `Dashboard.tsx`, `ConsultarResultados.tsx`.
- **Causa raiz:** ausência de SSOT desde o início.
- **Coremas equivalente:** `StatusEnum` + accessor único no model `Appointment`.
- **Fix:** `src/lib/atendimentoStatus.ts` (Fase 2).

### 2.2 Regras de parâmetro de exame fragmentadas
- **Onde:** `exame_parametros` (DB), `criticoChecker.ts`, `parseValorReferencia.ts`, `ParamTypedInput.tsx`, `ResultadoValidationBar`.
- **Causa raiz:** evolução incremental sem refactor.
- **Coremas equivalente:** trait `new_parameter` centraliza tudo.
- **Fix:** `ParameterRulesService` (Fase 3).

### 2.3 Stores Zustand redundantes
- **Quantidade:** ~30 stores; ~10 são cache puro derivável de query.
- **Exemplos acidentais:** `auditLogsStore` (paginação — React Query), `orcamentoStore` (tela única — local), `mapaTrabalhoStore` (tela única), `estoqueStore`, `convenioFaturasStore`.
- **Coremas equivalente:** zero stores client-side (server-rendered).
- **Fix:** `store-reduction-plan.md` (Fase 6).

### 2.4 Tabelas de auditoria sobrepostas
- **Hoje:** `audit_logs`, `atendimento_audit`, `storage_audit`, `pdf_override_audit`, `tenant_provision_audit`, `subscription_changes_log`, `tenant_migration_log`, `app_settings_audit`, `protocolo_auditoria`, `criticos_comunicacoes`.
- **Causa raiz:** cada feature criou sua própria tabela.
- **Coremas equivalente:** uma `audit_logs` única + `traceabilities` para clínico.
- **Fix:** `audit-consolidation-plan.md` (Fase 9) — alvo: 2 tabelas (`operational_audit`, `platform_audit`) + views compatíveis.

### 2.5 Dicionários fragmentados
- **Hoje:** `motivos_cancelamento`, `recoletas_motivos`, `financeiro_formas_pagamento`, `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`.
- **Coremas equivalente:** `motives` única com enum `MotiveEnum`.
- **Fix:** consolidar em `select_options` com `categoria` (Fase 8/10).

### 2.6 Helpers de formatação duplicados
- **Onde:** componentes reimplementam CPF/data/idade/moeda inline.
- **Coremas equivalente:** helpers `Fill`, `Date`, `Sanitize`.
- **Fix:** `src/lib/format.ts` + ESLint rule (Fase 4/11).

### 2.7 Dual-mode em `ConsultarResultados`
- 3 flags booleanas → 8 estados, 2 intencionais.
- **Causa raiz:** migração legacy→paginada incompleta.
- **Fix:** remover flag `USE_LEGACY_STORE` após estabilização.

### 2.8 Reconnect realtime duplicado
- Mesmo padrão de back-off em `SolicitacoesSite.tsx` e `useSolicitacoesNaoLidas.ts`.
- **Fix:** hook `useRealtimeChannel` compartilhado.

### 2.9 `comprovantes.ts` god-file (1121 linhas)
- 10 responsabilidades distintas.
- **Fix:** split em `domains/result/services/` (PDF, hash, vCard, QR, template, legal).

---

## 3. O que NÃO copiar do Coremas

| Pattern Coremas | Por que rejeitar |
|---|---|
| `users.permissions` como TEXT | Privilege escalation — Lovable usa `user_roles` separado (correto). |
| `payment_apis.key/secret` plaintext | LGPD/PCI — Lovable cifra com AES-GCM. |
| `access_key` 8 chars sem rate-limit | Brute-force trivial — Lovable tem `public_rate_limits`. |
| Single-tenant hardcoded | Inviável p/ SaaS. |
| `Pipeline` p/ tudo | Over-engineering em fluxos triviais — usar onde fizer sentido (criar atendimento). |
| Template PDF único | Lovable precisa `documento_templates` por tenant. |

---

## 4. Conclusão

> **~75% essencial / ~25% acidental.**
> Refatorar o acidental, sem tocar o essencial, entrega ~20% menos LOC, ~40% menos stores, ~80% menos tabelas de auditoria — sem regressão funcional.
