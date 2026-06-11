# Store Reduction Plan

> Meta: reduzir stores Zustand em 30–50% sem perda funcional.
> Base: `docs/governance/state-governance.md`.

---

## 1. Classificação

### 🔴 Obrigatória — manter (núcleo operacional)
| Store | LOC | Justificativa |
|---|---|---|
| `atendimentoStore` | 1514 | Núcleo; 20+ telas. **Congelado.** |
| `pacienteStore` | 256 | Lookup global. |
| `usuariosStore` | 430 | Sidebar/badges. |
| `exameCatalogoStore` | 399 | Catálogo global. |
| `exameParametrosStore` | 221 | Catálogo clínico. |
| `valoresReferenciaStore` | 191 | Resolver clínico. |
| `tabelaPrecoStore` | 222 | Precificação. |
| `selectOptionsStore` | 249 | Dicionários. |
| `labConfigStore` | 242 | Config tenant. |
| `documentoTemplatesStore` | 241 | Lookup. |
| `convenioStore` | — | Lookup global. |
| `unidadeStore` | — | Lookup global. |
| `labApoioStore` | — | Lookup global. |
| `financeiroStore` | 334 | Cruzamento com atendimento. |

### 🟠 Migrar para React Query (cache puro)
| Store | LOC | Por quê |
|---|---|---|
| `auditLogsStore` | 411 | Lista paginada — caso clássico de React Query. |
| `auditoriaStore` | 216 | Mesmo padrão. |
| `producaoMetricsStore` | — | Métricas (refetch suficiente). |
| `rastreabilidadeStore` | 451 | Consultado em poucas telas; query+invalidate. |
| `sorotecaStore` | 676 | Tela única; pode virar query+cache local. |
| `mapaTrabalhoStore` | 300 | Tela única. |
| `estoqueStore` | 358 | Tela única. |
| `orcamentoStore` | 239 | Tela única. |
| `convenioFaturasStore` | 375 | Telas isoladas. |

### 🟢 Eliminar (deriváveis)
| Store / estado | Origem real | Ação |
|---|---|---|
| `financeiroListasStore` | `selectOptionsStore` após Fase 8 | Eliminar. |
| `motivosCancelamentoStore` | `selectOptionsStore` após Fase 8 | Eliminar. |
| `recoletasMotivosStore` | `selectOptionsStore` após Fase 8 | Eliminar. |
| `reguasEtariasStore` | `valoresReferenciaStore` | Avaliar fusão. |
| `setoresLaboratoriaisStore` | Lookup pequeno — query+cache | Eliminar opcional. |

### 🚫 Intocáveis
- `AuthContext` (não é store Zustand, mas state crítico).
- TenantStore implícito em `tenantResolver`.

---

## 2. Plano por sprint

| Sprint | Ação | Risco |
|---|---|---|
| 1 | Migrar `auditLogsStore` + `auditoriaStore` → React Query. | Baixo |
| 2 | Eliminar `motivosCancelamentoStore`/`recoletasMotivosStore`/`financeiroListasStore` (depende Fase 8 DB). | Baixo |
| 3 | Migrar `orcamentoStore` + `estoqueStore` → state local + query. | Médio |
| 4 | Migrar `mapaTrabalhoStore` → query. | Médio |
| 5 | Migrar `sorotecaStore` + `rastreabilidadeStore` → query. | Médio |
| 6 | Avaliar `convenioFaturasStore` → query. | Médio |

**Resultado projetado:** ~30 → ~18 stores (-40%).

---

## 3. Regras permanentes

Adicionar a `ENGINEERING_RULES.md`:

```text
Antes de criar nova store global, responder SIM a uma:
1. Consumido por >= 3 telas independentes?
2. Precisa persistir entre navegações sem refetch?
3. Lookup compartilhado (catálogo/dicionário/config tenant)?

NÃO a todas → useState local ou React Query.
```

---

## 4. Não fazer

- ❌ Tocar em `atendimentoStore` (congelado).
- ❌ Eliminar store sem migrar todos consumidores primeiro.
- ❌ Eliminar realtime junto com store (questão ortogonal — ver `realtime-reduction-plan.md`).
