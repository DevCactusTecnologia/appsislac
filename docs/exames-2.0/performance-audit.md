# Auditoria — Performance

## Consultas e cache

### Two-tier cache (`exameCatalogoStore.ts`)
- **Boot:** lê apenas **SLIM_COLUMNS** (16 colunas) para todos os exames
  (~441 linhas).
- **On-demand:** `getExameCatalogoCompleto(id)` busca as 48 colunas
  restantes só ao abrir o dialog de edição.
- ✔ Excelente padrão.

### Listagens
- `getExamesCatalogo()` é síncrono em memória (após boot).
- Filtros em `ExamesTab` são client-side (busca + categoria + ativo). ✔

### N+1
- Não detectado. `exames_catalogo` é carregado uma vez; satélites
  (`parametros`, `layouts`, `vr`) são carregados sob demanda por exame.

### Índices
| Tabela | Índices úteis |
|---|---|
| `exames_catalogo` | nome, mnemonico, ativo, setor_id, lab_apoio_id, tenant_id |
| `tabela_preco_itens` | (tabela, nome_exame), exame_id |
| `valores_referencia` | (exame_nome, parametro_nome) |
| `exame_parametros` | exame_id |
| `exame_layouts` | exame_id |
| `atendimento_exames` | atendimento_id, status, exame_id (14 índices ao todo) |

### Oportunidades
1. 🟢 Índice parcial `WHERE ativo=true` em `exames_catalogo(nome)` pode
   acelerar a listagem default.
2. 🟢 `tabela_preco_itens` tem `exame_id` indexado — bom.
3. 🟡 Quando os 25 campos mortos forem removidos, a tabela cairá em ~30 %
   de tamanho (≈ 90 kB economizados).

## Bundle (frontend)
- `ParametrosDialog.tsx` (788 linhas) e `ExamesTab.tsx` (976 linhas) são os
  maiores ofensores — candidatos a code-split.
- CKEditor (carregado por `LayoutDialog`) já é lazy-loaded.

## Veredito
Performance saudável. Maior ganho viria de **schema slim-down**, não de
otimização de query.
