# Soroteca — Pesquisa

## Implementação
- `Soroteca.tsx` (UI) + `sorotecaStore.ts:419-548` (`buscarAmostrasAvancado`).
- **Debounce 350ms** nos campos `paciente`, `protocolo`, `codigo_barra` (`Soroteca.tsx:182-184`).
- **Paginação server-side**, `pageSize = 30` (`Soroteca.tsx:176-177`); reset ao mudar filtros (`:344`).
- **Sem React Query** — usa `useEffect` + `useCallback` com deps explícitas (`:338`).

## Filtros suportados
`status[]`, `material_ids[]`, `local_id`, `galeria_id`, `paciente_search`, `protocolo`, `codigo_barra`, `coleta_inicio/fim`, `validade_inicio/fim`, `sem_armazenamento`, `armazenadas`.

## Cobertura de índices
| Filtro | Índice cobrindo |
|---|---|
| `status` + `tenant_id` + `data_validade` | `idx_amostras_tenant_status_validade` |
| `codigo_barra` + `tenant_id` | `idx_amostras_tenant_codigo` |
| `material_id` | `idx_amostras_material_id` |
| `paciente_id` | `idx_amostras_paciente_exame` |
| `local_id` / `galeria_id` | indireto via pré-filtro client-side (ver gargalo) |

## Gargalos
`buscarAmostrasAvancado` executa **até 6 pré-queries sequenciais** antes da query principal:
- `posicoes_galeria → galerias → idsAmostrasPorAlocacao` (3 queries para filtro por local)
- `pacientes → amostras` (2 queries para filtro por nome de paciente)
- `atendimentos → amostras` (2 queries para filtro por protocolo)

Comentário no código (`sorotecaStore.ts:535`): _"Em escala grande, mover para RPC"_.

## Filtros redundantes
- `sem_armazenamento` e `armazenadas` são mutuamente exclusivos mas tratados como flags independentes — UI deveria forçar select único.
