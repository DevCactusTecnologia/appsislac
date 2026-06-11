# Domain Services Plan

> Estrutura `src/domains/` para concentrar regras de negócio.
> Inspiração: organização de Repositories/Services do Coremas.

---

## 1. Estrutura alvo

```text
src/domains/
  patient/
    services/      # PatientService, IdentityService
    repositories/  # PatientRepository (Supabase)
    validators/    # cpfValidator, idadeValidator
    types/
  appointment/
    services/      # AppointmentService, StatusService (deriveStatus)
    repositories/
    validators/
    types/
  result/
    services/      # ParameterRulesService, ReleaseService, PdfService
    repositories/
    validators/    # criticalChecker, referenceResolver
    types/
  finance/
    services/      # InvoiceService, PaymentService, BudgetService
    repositories/
    validators/
    types/
  tenant/
    services/      # TenantService, FeatureFlagService, BrandingService
    repositories/
    validators/
    types/
  notification/
    services/      # WhatsAppService, EmailService
    repositories/
    validators/
    types/
  exam/
    services/      # ExamCatalogService, PricingService
    repositories/
    validators/
    types/
  auth/
    services/      # AuthService (wrapper Supabase), RoleService
    types/
```

---

## 2. Migração — `calculate* / generate* / build* / derive* / validate* / release* / send*`

| Função/regra atual | Local atual | Destino proposto |
|---|---|---|
| `deriveAtendimentoStatus` | espalhado | `appointment/services/StatusService.ts` |
| `getParameterRules` | a criar | `result/services/ParameterRulesService.ts` |
| `criticoChecker` | `src/lib/criticoChecker.ts` | `result/validators/criticalChecker.ts` |
| `parseValorReferencia` | `src/lib/parseValorReferencia.ts` | `result/validators/referenceResolver.ts` |
| `buildExamesCobranca` | `pages/NovoAtendimento/` | `appointment/services/CobrancaBuilder.ts` |
| `pricing.ts` | `pages/NovoAtendimento/` | `exam/services/PricingService.ts` |
| `comprovantes.ts` (split) | `src/lib/` | `result/services/PdfService.ts`, `result/services/QrService.ts`, `result/services/VCardService.ts`, `result/services/LegalTextService.ts` |
| `dossieRastreabilidade` | `src/lib/` | `result/services/TraceabilityService.ts` |
| `etiquetaAmostra` | `src/lib/` | `result/services/LabelService.ts` |
| `validarCredenciaisAnalista` | `src/lib/` | `auth/services/AnalystAuth.ts` |
| `regulatorio*` | `src/lib/` | `appointment/services/RegulatoryService.ts` |
| `labApoio.ts` | `src/lib/` | `exam/services/SupportLabService.ts` |

---

## 3. Contrato de service

```ts
// Template
export class XxxService {
  constructor(private repo: XxxRepository) {}
  // métodos puros, sem JSX, sem toast, sem navigate
}
```

**Regras:**
- Services não importam React, hooks, ou `@/integrations/supabase/client` diretamente — usam repository.
- Repositories são a única camada que conhece Supabase.
- Validators são funções puras testáveis.

---

## 4. Plano (incremental, sem big-bang)

| Sprint | Domínio | Ação |
|---|---|---|
| 1 | appointment | Mover `deriveStatus` + `pricing` + `buildExamesCobranca`. |
| 2 | result | Criar `ParameterRulesService`; mover `criticoChecker` + `parseValorReferencia`. |
| 3 | result | Split `comprovantes.ts` em 4 services. |
| 4 | exam | Mover `pricing` + `labApoio` + catálogo. |
| 5 | finance | Mover regras de fatura/pagamento (Financeiro `helpers.ts`). |
| 6 | notification | Encapsular WhatsApp em service. |
| 7 | tenant | Encapsular feature flags + branding. |
| 8 | patient + auth | Finalizar. |

**Risco geral:** Médio (refactor estrutural). Mitigação: feature flag por domínio; testes Vitest obrigatórios antes do switch.

---

## 5. Não fazer

- ❌ Criar `BaseService<T>` ou abstrações genéricas vazias.
- ❌ Migrar tudo num único PR.
- ❌ Tocar em business logic durante o move (refactor estrutural primeiro, mudanças de regra depois).
