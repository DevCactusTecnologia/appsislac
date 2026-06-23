# Plataforma 2.0 — Fase 6: Views Órfãs

13 views em `public`. Análise de consumidores via `rg "view_name" src/ supabase/functions/`.

| View                          | Consumidor | Status |
|-------------------------------|------------|--------|
| `convenio_competencia_resumo` | `useConvenioFaturas`, `convenioCompetenciasStore` | Ativa |
| `convenio_fatura_resumo`      | `convenioFaturasStore`, faturas page | Ativa |
| `exames_publicos_view`        | Portal público, `exameCatalogoStore` | Ativa |
| `financeiro_entradas`         | `financeiroStore`, Financeiro page | Ativa |
| `platform_health_aggregate`   | Super-admin dashboards (edge fn `super-admin-*`) | Ativa |
| `provider_health_current`     | Painel de integrações | Ativa |
| `tenant_public`               | Landing/inscrição pública | Ativa |
| `unidades_publicas`           | Solicitação pública, portal | Ativa |
| `vw_coleta_diaria`            | Dashboard/produção | Ativa |
| `vw_coletas_operacionais`     | Coleta page, exam pipeline | Ativa |
| `vw_liberacao_diaria`         | Dashboard/produção | Ativa |
| `vw_producao_diaria`          | Dashboard | Ativa |
| `vw_producao_operacional`     | Produção page | Ativa |

**Resultado: 0 views órfãs.** Todas as 13 têm consumidor real.

> Observação: o linter Supabase sinaliza 7 views como `SECURITY DEFINER VIEW` (ERROR — ver `security-audit.md`). Não é caso de remoção, é caso de revisão de propriedade.
