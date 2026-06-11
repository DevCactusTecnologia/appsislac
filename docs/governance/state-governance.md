# State Governance

> Fase 4 — Classificação de todo estado global do SISLAC.

## Princípio

> Estado global é dívida. Cada store novo precisa justificar sua existência.

## Inventário de stores (`src/data/*Store.ts`)

| Store | LOC | Classe | Justificativa |
|---|---|---|---|
| `atendimentoStore` | 1514 | 🔴 Global obrigatório | Núcleo operacional; consumido em 20+ telas. **Congelado**. |
| `sorotecaStore` | 676 | 🟡 Global opcional | Pode virar query React Query no futuro |
| `rastreabilidadeStore` | 451 | 🟡 Global opcional | Idem |
| `usuariosStore` | 430 | ✅ Global obrigatório | Cache de perfis (sidebar, badges) |
| `auditLogsStore` | 411 | 🟠 Migrar p/ query | Lista paginada — não precisa Zustand |
| `exameCatalogoStore` | 399 | ✅ Global obrigatório | Catálogo lookup em N telas |
| `convenioFaturasStore` | 375 | 🟡 Global opcional | Telas isoladas — candidato a local |
| `estoqueStore` | 358 | 🟡 Global opcional | Tela única — pode virar local |
| `financeiroStore` | 334 | ⚠️ Global obrigatório | Necessário pelo cruzamento com atendimento |
| `mapaTrabalhoStore` | 300 | 🟡 Global opcional | Tela única |
| `pacienteStore` | 256 | ✅ Global obrigatório | Lookup global |
| `selectOptionsStore` | 249 | ✅ Global obrigatório | Dicionários compartilhados |
| `labConfigStore` | 242 | ✅ Global obrigatório | Configuração do tenant |
| `documentoTemplatesStore` | 241 | ✅ Global obrigatório | Lookup |
| `orcamentoStore` | 239 | 🟡 Global opcional | Tela única |
| `tabelaPrecoStore` | 222 | ✅ Global obrigatório | Precificação |
| `exameParametrosStore` | 221 | ✅ Global obrigatório | Catálogo |
| `auditoriaStore` | 216 | 🟠 Migrar | Igual `auditLogsStore` |
| `valoresReferenciaStore` | 191 | ✅ Global obrigatório | Lookup clínico |
| Demais (~10) | <200 | ✅ ok | Lookups leves |

### Legenda
- 🔴 Crítico congelado (não tocar)
- ✅ Global obrigatório justificado
- 🟡 Global opcional (pode migrar; sem urgência)
- 🟠 Candidato natural a React Query
- ⚠️ Acoplado (precisa cuidado)

## Regra permanente

**Antes de criar novo estado global**, responder SIM a pelo menos uma:

1. É consumido por **≥ 3 telas independentes**?
2. Precisa **persistir** entre navegações sem refetch?
3. Carrega **lookup compartilhado** (catálogo, dicionário, config tenant)?

Se NÃO a todas: usar `useState` local ou React Query.

## Quando promover local → global

- Mesmo dado virou cache em 3+ telas.
- Sincronização cross-tela passou a ser necessária.
- Realtime invalidation precisa coordenar múltiplas telas.

## Quando rebaixar global → local

- Único consumidor há mais de 6 meses.
- Tela isolada com fluxo próprio.
- Pode ser migrado para React Query sem cross-coupling.

## Limites por arquivo (alerta, não bloqueio)

| Tipo | Meta | Alerta |
|---|---|---|
| Página | 800 | 1000 |
| Componente | 300 | 500 |
| Hook | 250 | 400 |
| Store | 1200 | 1500 |

`atendimentoStore` (1514) está **fora da meta** mas **congelado por decisão
arquitetural** — qualquer slicing exige aprovação explícita.
