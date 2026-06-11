# Engineering Hotspots

> Fase 6 — Monitoramento de crescimento.
> Gerado a partir de `scripts/check-file-size.sh`.

## Classificação

| Faixa | Ação |
|---|---|
| 1000–1199 | 🟢 Observação |
| 1200–1499 | 🟡 Atenção |
| 1500–1999 | 🟠 Plano preventivo |
| ≥ 2000 | 🔴 Refatoração obrigatória |

## Hotspots atuais

| LOC | Arquivo | Classe |
|---|---|---|
| 2619 | `src/pages/ResultadoDetalhe.tsx` | 🔴 |
| 2598 | `src/pages/NovoAtendimento.tsx` | 🔴 |
| 2503 | `src/components/configuracoes/mapas/RichTextEditorPro.tsx` | 🔴 |
| 2395 | `src/pages/Financeiro.tsx` | 🔴 |
| 1514 | `src/data/atendimentoStore.ts` | 🟠 (congelado) |
| 1160 | `src/pages/superadmin/SuperAdminTenantDetalhe.tsx` | 🟢 |
| 1158 | `src/pages/Index.tsx` | 🟢 |
| 1146 | `src/pages/Mapa.tsx` | 🟢 |
| 1129 | `src/pages/RegistrarColeta.tsx` | 🟢 |
| 1121 | `src/lib/comprovantes.ts` | 🟢 |
| 1002 | `src/pages/AnalisarAmostra.tsx` | 🟢 |

`src/integrations/supabase/types.ts` (6839) é **auto-gerado** — excluído.

## Política

- 🔴 **não bloqueia build** (todos os 11 estão em `scripts/file-size-allowlist.txt`).
- Adicionar novo 🔴 exige justificativa no PR.
- Slicing só ocorre quando o arquivo for tocado por demanda de produto.
- `atendimentoStore.ts` está **congelado** por decisão arquitetural.

## Tendência

Após Sprint 0+1:
- `ResultadoDetalhe`: −10.7% (2933 → 2619)
- `NovoAtendimento`: −6.3% (2773 → 2598)
- `Financeiro`: −3.5% (2481 → 2395)
- `RichTextEditorPro`: −8.5% (2737 → 2503)

Nenhum novo hotspot 🔴 introduzido.
