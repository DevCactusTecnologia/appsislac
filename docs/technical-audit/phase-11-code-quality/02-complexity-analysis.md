# 02 — Complexity Analysis

## Métrica adotada
LOC por arquivo (evidência objetiva; ramificação/CC exigiria instrumentação não permitida na regra "não alterar código").

## Top 15 arquivos por LOC (`src/`)
| LOC | Arquivo |
|---:|---|
| 9041 | src/integrations/supabase/types.ts *(gerado)* |
| 3129 | src/pages/ResultadoDetalhe.tsx |
| 2829 | src/pages/NovoAtendimento.tsx |
| 1456 | src/pages/SorotecaEstrutura.tsx |
| 1310 | src/pages/Index.tsx |
| 1259 | src/pages/superadmin/SuperAdminTenantDetalhe.tsx |
| 1245 | src/pages/Soroteca.tsx |
| 1215 | src/pages/RegistrarColeta.tsx |
| 1149 | src/pages/Financeiro.tsx |
| 1147 | src/pages/Mapa.tsx |
| 1006 | src/pages/AnalisarAmostra.tsx |
| 981  | src/pages/SorotecaExpurgo.tsx |
| 976  | src/components/configuracoes/ExamesTab.tsx |
| 974  | src/components/configuracoes/SiteTab.tsx |
| 964  | src/components/configuracoes/ValoresReferenciaPanel.tsx |

## Top 10 Edge Functions por LOC
| LOC | Arquivo |
|---:|---|
| 476 | _shared/protocols/hermes-pardini.ts |
| 446 | super-admin-provision-tenant-schema-full |
| 378 | _shared/protocols/dbsync.ts |
| 375 | provider-catalog-import |
| 360 | super-admin-test-integration |
| 339 | super-admin-create-tenant |
| 337 | soroteca-sugerir-posicao |
| 305 | ai-suggest-exames |
| 296 | soroteca-reorganizar-galeria |
| 263 | _shared/integrationLog |

## Classificação (por LOC)
| Faixa | Contagem em `src/` | Classificação |
|---|---:|---|
| < 200 LOC | ~340 | Muito baixa / baixa |
| 200–500 LOC | ~65 | Moderada |
| 500–800 LOC | 39 | Alta |
| 800–1500 LOC | 22 | Muito alta |
| > 1500 LOC | 3 | Muito alta (crítica) |

- 64 arquivos > 500 LOC.
- 25 arquivos > 800 LOC.
- Concentração da complexidade em `pages/` (operacional) e em `components/configuracoes/` (admin).

## Observações
- `types.ts` (9.041 LOC) é gerado; deve ser excluído de qualquer análise humana.
- `ResultadoDetalhe.tsx` (3.129) e `NovoAtendimento.tsx` (2.829) reúnem múltiplos fluxos e são os dois arquivos de maior complexidade sustentada.
