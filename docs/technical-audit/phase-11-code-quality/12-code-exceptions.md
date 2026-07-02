# 12 — Code Exceptions

## Quantitativo (grep, sem alteração)
| Item | Ocorrências |
|---|---:|
| `TODO / FIXME / HACK / XXX` | 66 |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 7 |
| `eslint-disable` (linha ou bloco) | 48 |
| `as any` | 65 |
| `any` bare word | 0 |
| Non-null assertion (`!` em anotação de tipo) | 0 (padrão observado) |

## Distribuição — TODO/FIXME (top)
| Arquivo | Ocorrências |
|---|---:|
| src/pages/SolicitacoesSite.tsx | 9 |
| src/lib/__tests__/tenantValidation.test.ts | 6 |
| src/components/configuracoes/UnidadesTab.tsx | 6 |
| src/components/configuracoes/ConvenioExamesPanel.tsx | 4 |
| src/pages/SorotecaExpurgo.tsx | 3 |
| src/lib/mapaTemplates.ts | 3 |
| src/data/orcamentoStore.ts | 3 |

## Distribuição — `as any` (arquivos)
Concentração em:
- Edges super-admin (`super-admin-list-tenants`, `super-admin-test-integration`, `super-admin-check-tenant-schema`, `super-admin-provision-tenant-schema`, `super-admin-test-tenant-db`).
- Integrações (`integration-jobs-runner`, `integration-poll-results`, `lab-apoio-upload-pdf`, `provider-catalog-import`).
- Client: `documentoRenderer.ts`, `dossieRastreabilidade.ts`, `queryPatterns.ts`, `comprovantesRender.ts`, `tabelaPrecoStore.ts`, `useConvenioFaturas.ts`, `useCompliance.tsx`, `SuperAdminInscricoes.tsx`, `SuperAdminConfiguracoes.tsx`, `RelatorioRecoletas.tsx`.

## Distribuição — eslint-disable (top)
Concentração em: `pages/ResultadoDetalhe.tsx`, `pages/NovoAtendimento.tsx`, `pages/RegistrarColeta.tsx`, `pages/SorotecaEstrutura.tsx`, `pages/SorotecaExpurgo.tsx`, `pages/Resultados.tsx`, `main.tsx`, `hooks/useEnsureStore.ts`, `data/storeBoot.ts`.

## Justificativa
- Auditoria não permite abrir cada linha para reconstruir a intenção. Registro apenas quantitativo/distribuição.
- Densidade global de exceções: `(66+7+48+65) / 124.915 LOC ≈ 0,15 por 100 LOC` — baixa.
