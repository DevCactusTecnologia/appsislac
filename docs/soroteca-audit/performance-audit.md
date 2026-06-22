# Soroteca — Performance

## N+1 / múltiplos roundtrips

### `getAmostraDetalhe` (`sorotecaStore.ts:681-864`)
**6 queries sequenciais** por abertura de modal:
1. `amostras` por id (`:682`)
2. `pacientes` por `paciente_id` (`:695`)
3. `atendimentos` por `atendimento_id` (`:714`)
4. `atendimento_exames` por `amostra_id` (`:723`)
5. `atendimentos` novamente para protocolo/paciente dos exames vinculados (`:734`)
6. `labs_apoio` para nome do lab (`:766`)

### `buscarAmostrasAvancado` (`sorotecaStore.ts:419-548`)
Até **6 pré-filtros sequenciais** antes da query principal:
- `posicoes_galeria → galerias → idsAmostrasPorAlocacao` (3 queries para filtro por local)
- `pacientes → amostras` (2 queries para filtro por nome de paciente)
- `atendimentos → amostras` (2 queries para filtro por protocolo)

Comentário no código (`:535`): _"Em escala grande, mover para RPC"_.

### `proximaPosicaoLivre` (`sorotecaEstruturaStore.ts:289`)
2 roundtrips (posições + alocações ativas). Aceitável.

## `select("*")` em tabelas grandes
| Local | Coluna | Cap |
|---|---|---|
| `listarAmostras:360` | `*` | sem limit explícito |
| `getAmostraDetalhe:682` | `*` (amostras) | 1 linha |
| `listarEmprestimos:261` | `*` | `limit(500)` — cap sem paginação |

## Índices — suficientes para os filtros atuais
Ver `search-audit.md`.

## Crescimento
Schema suporta. Frontend começa a estressar acima de ~10k amostras pelo `buscarAmostrasAvancado` com filtros compostos.
