# Soroteca — Segurança

## RLS por tabela

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `amostras` | `visualizar_atendimentos` OR `registrar_coleta` OR `analisar_amostra` | `registrar_coleta` OR `editar_atendimento` OR `criar_atendimento` OR `admin` | idem INSERT | apenas `admin` |
| `locais_armazenamento` | tenant | `gerenciar_soroteca` | `gerenciar_soroteca` | `gerenciar_soroteca` |
| `galerias` | tenant | `gerenciar_soroteca` | `gerenciar_soroteca` | `gerenciar_soroteca` |
| `posicoes_galeria` | tenant | `gerenciar_soroteca` | `gerenciar_soroteca` | `gerenciar_soroteca` |
| `amostra_alocacoes` | tenant | `armazenar_amostra` | `armazenar_amostra` | apenas `super_admin` |
| `amostra_emprestimos` | tenant | `armazenar_amostra` | `armazenar_amostra` | apenas `super_admin` |
| `expurgo_lotes` | tenant | `armazenar_amostra` | `armazenar_amostra` | apenas `super_admin` |
| `expurgo_itens` | tenant | `armazenar_amostra` | `armazenar_amostra` | apenas `super_admin` |
| `materiais_amostra` | múltiplas | `admin` OR `manager` | `admin` OR `manager` | apenas `admin` |

## Quem pode...
- **Armazenar:** `armazenar_amostra` (alocações + empréstimos).
- **Emprestar:** `armazenar_amostra` (mesmo bucket).
- **Expurgar:** `armazenar_amostra` (insert lotes/itens).
- **Administrar estrutura:** `gerenciar_soroteca`.
- **Administrar catálogo:** `admin` ou `manager`.

## Riscos
1. **`gerenciar_soroteca` e `armazenar_amostra` não estão mapeadas no `has_permission()` padrão** (`migration 20260417021857`). Usuários não-admin com perfis padrão (`analista`, `recepcionista`, `financeiro`) **não recebem** essas permissões automaticamente. Requer `permissoes_extras` manual por usuário.
   - Sintoma esperado: erro 403 silencioso do banco quando triagem tenta armazenar.
2. **Frontend não pré-valida `has_permission`** antes de renderizar formulários — confia no erro do banco.
3. **Bypass super_admin** é correto: `is_super_admin()` aparece em todas as policies como OR.
