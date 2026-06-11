# IA_ARCHITECTURE_RULES — SISLAC

> Governança arquitetural para evolução segura por IA.
> Toda modificação no SISLAC deve respeitar estas regras.
> Violações justificadas devem ser registradas em ADRs (`docs/adr/`).

## 1. Naming — um conceito = um nome

| Conceito | Localização | Responsabilidade |
|---|---|---|
| **protocols** | `supabase/functions/_shared/protocols/` | Envelopes SOAP/XML, parsers, serializers, WSDL. Sem I/O. Sem runtime. |
| **drivers** | `supabase/functions/_shared/drivers/` | Runtime: dispatch, retry, polling, circuit breaker, capabilities server. |
| **providers (UI)** | `src/integrations/providers/<id>/` | UI declarativa: campos, cards, ações visíveis, status. Nunca chama driver direto. |
| **canonical** | `supabase/functions/_shared/canonical/` | Modelos de domínio agnósticos a provider (versionados). |
| **snapshot** | tabela `integration_snapshots` | Estado fotográfico imutável; `runtime` = jobs em movimento. |

Proibido reintroduzir `_shared/providers/` (colidia com `src/integrations/providers/`).

## 2. Capabilities — fonte única

- Fonte oficial: `src/integrations/contracts/capabilities.ts` (`CANONICAL_CAPABILITY_KEYS`).
- Espelho server: `ServerCapabilities` em `supabase/functions/_shared/drivers/types.ts`.
- Adicionar nova capability exige PR tocando AMBOS arquivos + atualizar `CAP_LABEL`.
- Aliases legados (`pending_workflow`, `reprint_label`, `logistics_tracking`, `recollection`)
  são aceitos apenas em leitura via `hasCapability`. **Não criar novos aliases.**

## 3. Forbidden patterns

- ❌ `if (provider === "HERMES_PARDINI") { ... }` — usar `hasCapability` ou registry.
- ❌ `BaseStore<T>`, `BaseDialog<T>`, abstrações genéricas reutilizáveis com generics.
- ❌ Fontes paralelas de capabilities, status, ou domain.
- ❌ Stores híbridas (UI + persistência + business numa só função).
- ❌ Edge function chamando outra edge por path (`/api/x`); usar invoke ou URL completa.

## 4. Stores (Zustand)

- Limite mole: **600 linhas** por store. Acima disso, considerar slicing por domínio
  (`status.ts`, `pricing.ts`, ...) com barrel re-export para preservar a API pública.
- Schemas de escrita obrigatórios para mutações persistidas.
- Sem side-effects escondidos em getters.
- Componentes novos DEVEM preferir **selectors granulares** (`useStore(s => s.x)`) em vez de
  consumir o store inteiro (`useStore()`). Reduz re-render cascata.
- **Derived state** (totais, agrupamentos, status calculado) deve viver em selectors
  centralizados no próprio store/módulo — nunca recomputado ad-hoc em cada componente.

## 5. Edge functions

- Novas edge functions DEVEM iniciar com `_shared/edgeBoot.ts` (`boot()` wrapper).
- Logs estruturados via `emitEvent` (discriminated union `IntegrationEvent`).
- Tenant resolvido server-side via profile do JWT — nunca confiar em `tenant_id` do body.
- Sem auth custom replicado: usar `boot({ require_auth: true, require_tenant: true })`.
- Funções legadas podem permanecer sem `boot()` **até serem tocadas**; ao editar, migrar.
- Migração ocorre em **ondas incrementais** (admin → super-admin → integration → public/webhook).
  Enforcement gradual é preferível a migração big-bang.

## 6. Integration engine

- Toda integração começa por **job** em `integration_jobs` (idempotency_key obrigatório).
- UI nunca chama driver direto — apenas `lab-apoio-adapter` (HTTP facade).
- Protocols não conhecem runtime. Drivers não conhecem UI. Providers UI não conhecem drivers.
- Pipelines passam por: Circuit Breaker → Driver → Health metrics → DLQ (em falha morta).
- Toda integração DEVE retornar **modelos canônicos** (`_shared/canonical/`) antes de
  persistência ou exposição. Modelos provider-specific (DTOs SOAP/XML) **não escapam**
  da camada de driver.

## 7. Multi-tenant

- Toda tabela de domínio: `tenant_id uuid NOT NULL`.
- 4 RLS policies por tabela usando `current_tenant_id()` + `is_super_admin()` + `has_permission()`.
- Frontend NUNCA envia `tenant_id` ao backend.

## 8. Refatorações proibidas (sem aprovação explícita)

- Reescrita do pipeline, drivers, ou stores grandes.
- Introdução de Redux, RTK Query, microservices, workflow engines.
- Alterações em fluxos clínicos (atendimento, coleta, análise, resultado, pagamento).

## 9. Testes obrigatórios ao mexer em integrações

- Hermes: `dispatch`, `polling`, `pdf` continuam intactos.
- DBSync: preview/MOCK intactos.
- `vitest run capabilities-parity` — chaves canônicas frontend × server.

## 10. UI consistency

Governança visual IA-first: **consistência > criatividade**. Antes de criar qualquer
badge / dialog / drawer / alert / status visual, verificar se já existe equivalente.

Componentes canônicos (não duplicar):

| Necessidade | Componente oficial |
|---|---|
| Status operacional de integração | `IntegrationStatusBadge` |
| Lista de warnings de integração | `IntegrationWarningsList` |
| Destino do exame (interno/apoio) | `LabBadge` |
| Status semântico genérico | `StatusBadge` |
| Selo recém-nascido | `RecemNascidoBadge` |
| Dialog modal | `components/ui/dialog` (flat, backdrop-blur 6px) |
| Trocar responsável | `AlterarResponsavelPopup` |

Regras:

- Reutilizar componente existente sempre que houver equivalência semântica.
- **Status visual centralizado** — derivado de `resolveIntegrationStatus`/store, nunca
  recomputado em cada tela.
- **Dialogs flat** com backdrop-blur 6px; sem sombras pesadas, sem gradientes.
- **Progressive disclosure** — esconder complexidade atrás de "ver mais"/expansão;
  poucos cliques no caminho principal.
- Drawers, dialogs e popups seguem um único padrão visual por categoria. Variações
  cosméticas só com justificativa de UX.
- Proibido criar componentes "smart" excessivamente genéricos (`<SmartTable<T>>`,
  `<UniversalForm>`); ver §3 forbidden patterns.
- Adicionar variantes ao componente canônico é preferível a forkar um novo.

## 11. Query / Data governance

Governança de fetching, cache e estado derivado para escala multi-tenant.

Regras:

- **Selectors granulares** obrigatórios em componentes novos. Proibido
  `const store = useAtendimentoStore()` em componentes de tela — assinar apenas as
  fatias necessárias.
- **Derived state > duplicated fetched state** — calcular a partir do que já está
  em cache; não refazer fetch para obter agregados.
- **Cache slim**: respeitar `staleTime`/`gcTime` do `queryClient` central
  (`src/lib/queryClient.ts`). Não criar `QueryClient` paralelo.
- **Invalidation centralizada** por chave canônica; evitar `queryClient.clear()`
  fora do reset de tenant.
- **Polling controlado** — intervalos explícitos, parar ao desmontar, nunca <5s
  sem justificativa operacional. Preferir polling a realtime quando possível.
- **Realtime** apenas com justificativa operacional clara (ex.: fila de coleta
  ao vivo). Sem realtime "decorativo".
- **Subscriptions pequenas e específicas** (uma tabela, filtro de tenant).
  Sem `*` em schemas inteiros.
- **Sem N+1**: agregar/joinar no servidor; nunca iterar fetch por linha de lista.
- Stores secundários carregam via `useEnsureStore` (lazy, idempotente) — não
  hidratar tudo no boot.

## 12. File size governance

Arquivos grandes aumentam **drift semântico**, **duplicação por IA** e **risco de
regressão**. Limites por arquivo (componentes, stores, libs):

| Tamanho | Ação obrigatória |
|---|---|
| 🟡 > 600 linhas | Review arquitetural recomendado; considerar slicing |
| 🟠 > 800 linhas | Justificativa explícita no PR/commit |
| 🔴 > 1000 linhas | Critical architecture review obrigatório antes de merge |

Princípios:

- **Slicing incremental** preferível a rewrite. Quebrar por responsabilidade
  (helpers, subcomponentes, hooks) mantendo o arquivo principal como orquestrador.
- **Barrel / facade compatível** preferível a breaking change. Re-exportar tipos e
  símbolos públicos do path original para não quebrar consumidores.
- **Preservar API pública** sempre que possível — refator estrutural não deve forçar
  mudança em N call sites no mesmo PR.
- Padrão de slicing já aplicado em `NovaEntradaSaidaDialog/`, `CadastroPacienteDialog/`
  serve como referência (helpers + subcomponentes em pasta irmã).

---

_Última revisão: 2026-05-09 — P0 IA-First Governance Hardening + UI/Query/Size._
