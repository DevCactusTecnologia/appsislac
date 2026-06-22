# Atendimento 2.0 — Fase 1.8 — Performance Operacional

## Tamanho dos arquivos críticos

| Arquivo | Linhas | Risco |
|---|---|---|
| `src/pages/NovoAtendimento.tsx` | 2801 | 🔴 muito alto |
| `src/pages/ResultadoDetalhe.tsx` | 2648 | 🔴 muito alto |
| `src/pages/RegistrarColeta.tsx` | 1197 | 🔶 alto |
| `src/pages/AnalisarAmostra.tsx` | 994 | 🔶 alto |
| `src/pages/Resultados.tsx` | 644 | 🟢 ok |
| `src/pages/Producao.tsx` | 413 | 🟢 ok |
| `src/data/atendimentoStore/*` (split) | 2032 (7 arquivos) | 🟢 ok |

## Stores grandes
- `atendimentoStore` foi corretamente splittado (Fase 4 do Architectural Split). API pública preservada.
- `mapaTrabalhoStore` (300), `recoletasStore` (149) — saudáveis.

## Componentes pesados
- `ResultadoDetalhe/LayoutScientificFormRenderer.tsx` — render por linha de parâmetro com fórmulas; potencial de re-render em cascata.
- `MapaPreviewDialog.tsx` — preview HTML do mapa A4; pesado em mapas grandes (Playwright cobre).
- `ExamesTerceirizadosPanel.tsx` — lista por job; aceita paginação.

## Queries pesadas (perfil esperado, sem alterar)

### Lê-se diretamente:
- `atendimentos_page` — paginação por filtros — usa índices em `status_atendimento`, `tenant_id`, `data`. Custo: O(N) por janela.
- `resultados_page` — paginação dos exames com agregação por status. Pode ficar lenta em tenants com >500k exames.
- `atendimentos_kpis` — agregação por status (vários COUNT FILTER). Boa quando há índice em `status_atendimento`.

### Triggers:
- `recompute_atendimento_status` roda a cada UPDATE de exame e pagamento — custo proporcional ao número de exames do atendimento (geralmente baixo).
- `audit_trigger` escreve em `audit_logs` para toda mutação — alto volume de escrita; tabela grande.

### RLS:
- Policies usam `current_tenant_id()` (cached) + `has_permission()` (subquery em `user_roles`). Custo aceitável; vale índice composto `(tenant_id, status_atendimento)` em `atendimentos`.

## Renderizações desnecessárias
- `NovoAtendimento.tsx` mantém estado local massivo (lista de exames, pagamentos, IA, paciente, solicitante) — uma mudança força re-render do bloco inteiro. Memoização parcial.
- `ResultadoDetalhe.tsx` re-renderiza o laudo a cada digitação de parâmetro (sem `useDeferredValue`).

## Fluxos lentos esperados
| Fluxo | Causa provável |
|---|---|
| Salvar atendimento com 30+ exames | Pricing cascata + RPC transacional — aceitável |
| Carregar Resultados com filtros amplos | RPC `resultados_page` — paginação OK; ordenar por status custa |
| Liberar exame com layout grande | Render do laudo + congelamento de snapshot |
| Painel Produção em tenant grande | Agregação em runtime (sem materialização) |
| Realtime de exames | Canal Postgres Changes filtrado por tenant — saudável |

## Sem alterar nada — recomendações para Fase 2
- Materializar `producao_diaria` (view ou MV).
- Quebrar `NovoAtendimento` em rotas/sub-componentes.
- Adicionar `useDeferredValue` no laudo.
- Avaliar particionamento de `audit_logs` (alto volume).

— FIM —
