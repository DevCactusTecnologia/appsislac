# Inventário Completo — Estoque 2.0 (Fase 1)

Auditoria 100% leitura. Nada foi alterado.

## 1. Frontend

### Páginas
| Arquivo | Linhas | Função |
|---|---|---|
| `src/pages/Estoque.tsx` | 847 | Página única do módulo. Contém KPIs, painel de inteligência, tabs Insumos/Lotes, drawer de Histórico e exclusão. |

### Componentes (`src/components/estoque/`)
| Arquivo | Linhas | Função |
|---|---|---|
| `InsumoDialog.tsx` | 202 | CRUD de insumo (catálogo). |
| `LoteDialog.tsx` | 204 | CRUD de lote + entrada inicial automática. |
| `MovimentacaoDialog.tsx` | 217 | Registro de entrada / saída / descarte / ajuste. |
| `FornecedorDialog.tsx` | 102 | CRUD de fornecedor (compartilhado com Configurações). |

### Outros pontos de consumo na UI
| Arquivo | Função |
|---|---|
| `src/components/configuracoes/FornecedoresTab.tsx` (142) | Cadastro de fornecedores em Configurações. Reusa `estoqueStore`. |
| `src/components/AppSidebar.tsx` | Item de menu `/estoque` (permissão `configuracoes_sistema`). |
| `src/App.tsx` | Rota `/estoque` (lazy). |

### Stores / Serviços / Hooks
| Arquivo | Linhas | Função |
|---|---|---|
| `src/data/estoqueStore.ts` | 358 | Única SSOT do frontend. Tipos `Fornecedor`, `Insumo`, `Lote`, `Movimentacao`; CRUD; helpers `statusValidade`, `diasParaVencer`, `totalEstoque`. |

Nenhum hook React Query, nenhum context, nenhum serviço auxiliar. Todo acesso é direto via `supabase` client dentro do store.

## 2. Backend

### Tabelas (`public` schema)
| Tabela | Cols | RLS policies | Origem |
|---|---|---|---|
| `estoque_fornecedores` | 10 | 4 (select / insert / update / delete) | migration `20260423220056` |
| `estoque_insumos` | 13 | 4 | mesma migration |
| `estoque_lotes` | 15 | 4 | mesma migration |
| `estoque_movimentacoes` | 11 | 3 (select / insert / delete — sem update) | mesma migration |

### Funções SQL
| Função | Tipo | Uso real |
|---|---|---|
| `estoque_aplicar_movimentacao()` | trigger function | Ativa via `trg_aplicar_movimentacao AFTER INSERT ON estoque_movimentacoes`. Atualiza `quantidade_atual` e `status` do lote. |
| `estoque_marcar_lotes_vencidos()` | RPC | **NÃO É CHAMADA EM LUGAR ALGUM** (nem frontend, nem edge function, nem cron). Apenas exportada nos types. ⚠ código morto. |

### Triggers
| Trigger | Tabela | Ação |
|---|---|---|
| `touch_estoque_fornecedores` | estoque_fornecedores | `updated_at = now()` |
| `touch_estoque_insumos` | estoque_insumos | idem |
| `touch_estoque_lotes` | estoque_lotes | idem |
| `trg_aplicar_movimentacao` | estoque_movimentacoes | Aplica delta de quantidade no lote. |

### Índices
| Tabela | Índices |
|---|---|
| estoque_fornecedores | `idx_estoque_fornecedores_tenant` |
| estoque_insumos | `_tenant`, `_categoria(tenant_id, categoria)`, `_nome(tenant_id, nome)` |
| estoque_lotes | `_tenant`, `_insumo`, `_validade(tenant_id, data_validade)` |
| estoque_movimentacoes | `_tenant`, `_insumo`, `_lote`, `_data(tenant_id, data DESC)` |

### Constraints / FK
- `estoque_insumos.fornecedor_id → estoque_fornecedores` (ON DELETE SET NULL)
- `estoque_lotes.insumo_id → estoque_insumos` (ON DELETE CASCADE)
- `estoque_lotes.fornecedor_id → estoque_fornecedores` (ON DELETE SET NULL)
- `estoque_movimentacoes.insumo_id → estoque_insumos` (ON DELETE CASCADE)
- `estoque_movimentacoes.lote_id → estoque_lotes` (ON DELETE SET NULL)
- Todas as 4 tabelas com `tenant_id → tenants(id) ON DELETE CASCADE`
- `status` em `lotes` e `tipo` em `movimentacoes` são `text` livres (sem CHECK constraint).

### Views
Nenhuma view. Nenhuma materialized view.

### Edge functions
Nenhuma edge function dedicada ao estoque. Apenas referência em `super-admin-tenant-backup` (dump das 4 tabelas).

## 3. Resumo
- 1 página, 4 dialogs, 1 store, 4 tabelas, 1 trigger funcional, 1 RPC morta.
- Zero hooks React Query. Zero cron. Zero edge function operacional.
- Toda lógica de negócio cabe em ~1.700 LOC.
