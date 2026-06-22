# Soroteca — Inventário Completo

> Auditoria 100% leitura · 0% código. Todas as referências em `arquivo:linha`.

## Frontend

| Arquivo | Linhas | Propósito |
|---|---|---|
| `src/pages/Soroteca.tsx` | 1147 | Pesquisa avançada, listagem paginada, scanner HID, descarte e modal de detalhe |
| `src/pages/SorotecaEstrutura.tsx` | 714 | CRUD de Locais, Galerias e Posições físicas |
| `src/pages/SorotecaTriagem.tsx` | 533 | Fluxo bipe → sugestão automática → alocação |
| `src/pages/SorotecaEmprestimos.tsx` | 570 | Workflow PENDENTE → APROVADO → RETIRADO → DEVOLVIDO |
| `src/pages/SorotecaExpurgo.tsx` | 953 | Criação de lotes, preview, execução item a item |
| `src/pages/SorotecaMateriais.tsx` | 311 | CRUD do catálogo `materiais_amostra` |
| `src/data/sorotecaStore.ts` | 865 | SSOT de amostras: criação, reutilização, pesquisa avançada, detalhe |
| `src/data/sorotecaEstruturaStore.ts` | 449 | CRUD locais/galerias/posições + alocação |
| `src/data/sorotecaEmprestimosStore.ts` | 330 | Transições de estado de empréstimos |
| `src/data/sorotecaExpurgoStore.ts` | 293 | CRUD lotes/itens de expurgo |
| `src/data/materiaisAmostraStore.ts` | 129 | CRUD do catálogo de materiais |
| `src/components/soroteca/AmostraDetalheDialog.tsx` | 558 | Modal: paciente, exames, timeline sintética, impressão |
| `src/components/soroteca/BarcodeScannerDialog.tsx` | 204 | Scanner via `BarcodeDetector` API + fallback manual |
| `src/components/soroteca/ReutilizarAmostraDialog.tsx` | ~60 | Escolha de amostra reutilizável |
| `src/components/soroteca/SorotecaShell.tsx` | ~50 | Wrapper de layout compartilhado |
| `src/components/soroteca/SorotecaNav.tsx` | ~40 | Navegação entre sub-módulos |

**Imports de etiqueta:** `AmostraDetalheDialog.tsx:42`, `src/lib/imprimirEtiquetaPorAtendimentoExame.ts:10`.

**Scanner HID:** `Soroteca.tsx:159,216-248` e `SorotecaTriagem.tsx:98,114-140` — implementações duplicadas (ver `dead-code-report.md`).

## Backend — migrations relevantes

| Migration | Conteúdo |
|---|---|
| `20260423192624_990cbae2` | `CREATE TABLE amostras` + 5 índices + 4 policies + trigger `tg_amostras_updated_at` + `marcar_amostras_vencidas()` |
| `20260423195623_e7fdf4ff` | `CREATE TABLE amostra_sequence` + RPC `gerar_codigo_amostra` + `_calc_dv_amostra` |
| `20260424022247_764791f6` | Índices: `idx_amostras_tenant_status_validade`, `idx_amostras_tenant_codigo` |
| `20260424144244_78eb5a96` | `CREATE TABLE audit_logs` + `audit_trigger()` genérico |
| `20260622213755_1e86a85d` | `locais_armazenamento`, `galerias`, `posicoes_galeria`, `amostra_alocacoes` + 2 UNIQUE PARTIAL + trigger `sync_amostra_localizacao` |
| `20260622223230_0ef07884` | `materiais_amostra` + triggers `sync_amostra_tipo_material` e `audit_materiais_amostra` + seed de 8 materiais |
| `20260622225429_4881526b` | `amostra_emprestimos` + UNIQUE PARTIAL `uniq_emprestimo_amostra_ativo` + `amostra_em_emprestimo_ativo()` |
| `20260622225950_ca4a2b30` | `expurgo_lotes`, `expurgo_itens` + UNIQUE PARTIAL + primeira versão de `aplicar_expurgo_amostra` (com bug `ativa=true`) |
| `20260622230056_ddca3978` | `CREATE OR REPLACE FUNCTION aplicar_expurgo_amostra` — versão correta com `retirada_em` |

### RPCs
| RPC | Migration | Propósito |
|---|---|---|
| `gerar_codigo_amostra(uuid, date)` | 20260423195623 | Sequência diária + DV |
| `_calc_dv_amostra(text)` | 20260423195623 | Dígito verificador (IMMUTABLE) |
| `marcar_amostras_vencidas()` | 20260423192624 | DISPONIVEL → VENCIDA |
| `current_tenant_id()` | anterior | Resolução de tenant no RLS |
| `amostra_em_emprestimo_ativo(uuid)` | 20260622225429 | Teste booleano (não consumido pelo frontend) |

### Índices
```
amostras: idx_amostras_status, idx_amostras_validade, idx_amostras_paciente_exame,
          idx_amostras_tenant_status_validade, idx_amostras_tenant_codigo, idx_amostras_material_id
amostra_alocacoes: uniq_posicao_ativa (PARTIAL WHERE retirada_em IS NULL)
                   uniq_amostra_alocacao_ativa (PARTIAL WHERE retirada_em IS NULL)
amostra_emprestimos: uniq_emprestimo_amostra_ativo (PARTIAL WHERE status IN PENDENTE,APROVADO,RETIRADO)
expurgo_itens: uniq_expurgo_amostra_ativa (PARTIAL WHERE status='PENDENTE')
materiais_amostra: uniq_materiais_amostra_tenant_nome (lower(nome))
```
