# Soroteca 2.0 — Fase 2: Estrutura Física (Relatório)

**Status:** ✅ Concluído. Aguardando aprovação para Fase 3.

## Objetivo

Substituir o campo `amostras.localizacao` (texto livre) por uma hierarquia
física real e auditável: **Local → Galeria → Posição**, com histórico
imutável de movimentações em `amostra_alocacoes`.

`amostras.localizacao` permanece **vivo** durante toda a transição e é
sincronizado automaticamente por trigger — zero regressão em Coleta,
Atendimento, Produção, Resultados, Etiquetas e Scanner.

## Banco

### Novas tabelas

| Tabela | Propósito | Campos-chave |
| ------ | --------- | ------------ |
| `locais_armazenamento` | Geladeira / freezer / armário / sala | `tenant_id`, `nome`, `tipo`, `temperatura_min`, `temperatura_max`, `ativo` |
| `galerias` | Subdivisão do local (bandeja, rack) | `local_id`, `nome`, `ordem`, `ativo` |
| `posicoes_galeria` | Slot individual onde a amostra fica | `galeria_id`, `codigo`, `ordem`, `ativo` |
| `amostra_alocacoes` | Histórico imutável de movimentações | `amostra_id`, `posicao_id`, `alocada_em`, `retirada_em`, `motivo_retirada`, `usuario_id` |

### Constraints

- `UNIQUE (galeria_id, codigo)` — código único por galeria.
- `UNIQUE INDEX uniq_posicao_ativa ON amostra_alocacoes(posicao_id) WHERE retirada_em IS NULL`
  → garante que cada posição só tem **uma amostra ativa** por vez.
- `UNIQUE INDEX uniq_amostra_alocacao_ativa ON amostra_alocacoes(amostra_id) WHERE retirada_em IS NULL`
  → impede a mesma amostra de estar em duas posições simultaneamente.
- `ON DELETE CASCADE` em hierarquia (Local → Galeria → Posição).
- `ON DELETE RESTRICT` em `posicao_id` da alocação — preserva histórico.

### RLS e permissões

- 4 policies por tabela: `SELECT`/`INSERT`/`UPDATE`/`DELETE` escopadas a
  `current_tenant_id()` + bypass via `is_super_admin()`.
- Estrutura física (locais/galerias/posições): requer permissão
  `gerenciar_soroteca` para mutação.
- Alocações: requer permissão `armazenar_amostra` para inserir/atualizar.
  `DELETE` apenas para super admin — histórico imutável.
- `GRANT` explícito para `authenticated` + `service_role` em todas as 4 tabelas.

### Trigger de retrocompatibilidade

`public.sync_amostra_localizacao()` (SECURITY DEFINER, EXECUTE revogado
de `PUBLIC`/`anon`/`authenticated`) mantém `amostras.localizacao` populada
com o texto `"Local > Galeria > Posição"` sempre que uma alocação ativa
existe — usado pelos fluxos atuais sem alterações.

## Frontend

### Novo arquivo

- `src/data/sorotecaEstruturaStore.ts` — store enxuto (CRUD + alocação).
  Não duplica `sorotecaStore.ts` (amostras continuam lá).
- `src/pages/SorotecaEstrutura.tsx` — UI de 3 colunas (Local | Galeria |
  Posição) com diálogos simples, criação de posições em lote
  (`A1..A50`) e remoção com confirmação.

### Rota

- `/soroteca/estrutura` (lazy, protegida por `registrar_coleta`).
  Permissões finas (`gerenciar_soroteca`, `armazenar_amostra`) ficam
  apenas no banco nesta fase — a UI consume erro via toast quando
  RLS bloqueia. (Permissões granulares são criadas em fase futura.)

### Helpers exportados para a Fase 3

- `proximaPosicaoLivre({ galeria_id?, local_id? })` — para sugestão
  automática na triagem.
- `alocarAmostra({ amostra_id, posicao_id, observacao? })`.
- `retirarAmostra({ alocacao_id, motivo })`.

## Preservação garantida

- `amostras`, `gerar_codigo_amostra`, audit_trigger, `criarAmostraParaExame`,
  `criarAmostrasParaExames`, `buscarAmostrasReutilizaveis`,
  `reutilizarAmostra`, `getAmostraDetalhe`, scanner HID e impressão de
  etiquetas — **nenhum byte alterado**.
- `amostras.localizacao` continua sendo a coluna de exibição em todas
  as telas existentes.

## Verificação

- Migration aplicada sem erros (linter listou 158 itens — todos pré-existentes
  ao projeto; nenhum criado por esta fase, exceto a função trigger que teve
  EXECUTE revogado).
- Build TypeScript verde após correção de prop `PageHeader` (`icon`/`subtitle`
  → `eyebrow`/`description`).

## Próximos passos (aguardando aprovação)

- **Fase 3 — Triagem e Armazenamento**: tela `/soroteca/triagem` consumindo
  `proximaPosicaoLivre` + scanner HID + transição `EM_TRIAGEM → ARMAZENADA`.
