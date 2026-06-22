# Atendimento 2.0 — Fase 1.9 — Legado e Complexidade

> Apenas **documentar** — não remover.

## Componentes redundantes / suspeitos
| Item | Observação |
|---|---|
| `NovoAtendimento.tsx` (2801 linhas) | Concentra wizard, IA, leitura de requisição, pricing, edição. Alvo natural de split. |
| `ResultadoDetalhe.tsx` (2648 linhas) | Múltiplas responsabilidades (parâmetros, críticos, liberação, retificação, impressão). |
| `AtendimentoDetalheDialog.tsx` | Sobreposição parcial com `NovoAtendimento` em modo leitura. |
| `ResultadoPopup.tsx` vs `ResultadoDetalhe.tsx` | Possível redundância de exibição; popup usado em fluxos rápidos. |

## Status paralelos / mapas duplicados (histórico)
- `atendimentoStatus.ts` é o **único mapa visual** ativo. Memória `domain/status-padronizados-flat` confirma consolidação (mapas paralelos foram removidos em fase anterior).
- `statusHelpers.ts` em `ResultadoDetalhe/` traduz local — não duplica catálogo, apenas adapta.

## Stores paralelas
- Não há stores paralelas para atendimento. O split em `atendimentoStore/` é arquitetural (mesmo singleton).
- `producaoMetricsStore` é leitura derivada — não duplica.

## RPCs paralelas
- `recompute_atendimento_status` e `recompute_atendimento_totais` coexistem por **propósitos diferentes** (status vs totais). Não é duplicação.
- `update_atendimento_tx` e `update_atendimento_exame_tx` coexistem — granularidade diferente; ambas usadas.

## Fluxos abandonados (heurísticos)
- Não foi identificado fluxo claramente abandonado no domínio operacional.
- Trilhas legadas de status mock/demo já foram removidas (memória `auth/frontend-implementacao`).

## Código órfão (heurístico)
- `src/components/AvaliacaoIADialog.tsx` — IA em modo mock (memória existente). Mantido por design.
- `src/pages/admin/CKEditorTest.tsx` — tela de teste do editor; útil mas é admin-only.

## Edge functions com sobreposição
- `lab-apoio-adapter` × `integration-dispatch` — caminhos diferentes para terceirização (adapter direto vs job runner). **Coexistência intencional** durante a transição para o sistema de jobs.
- `lab-apoio-cron-fetch` × `integration-poll-results` — análogo. Recomendação futura: convergir.

## Tabelas com schema amplo
| Tabela | Colunas | Observação |
|---|---|---|
| `exames_catalogo` | 69 | Carrega regulatório, integração e clínico. Candidata a split por subdomínios. |
| `atendimento_exames` | 46 | Carrega operacional, terceirização, snapshots e PDF override. Saudável. |
| `tenant_registry` | 28 | Plataforma — fora deste escopo. |

## Complexidade percebida
- **Alta** em NovoAtendimento e ResultadoDetalhe (concentração de regras no frontend).
- **Média** em RegistrarColeta e AnalisarAmostra.
- **Baixa** em Producao, Mapa, Resultados.

## Itens para Fase 2 considerar (só listar, não fazer)
1. Split arquitetural de NovoAtendimento e ResultadoDetalhe.
2. Convergência terceirizado: `lab-apoio-*` × `integration-*` para o caminho de jobs.
3. Tabela `coletas` formalizada (granularidade de auditoria).
4. Tabela/view `producao_diaria` materializada.
5. Avaliar split de `exames_catalogo` (clínico × integração × regulatório).

— FIM —
