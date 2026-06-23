# Plataforma 2.1 — Fase 6: Classificação de RPCs Suspeitas

> **Regra:** apenas classificar; **nenhuma remoção** executada.

| RPC | Classificação | Evidência | Recomendação futura |
|-----|---------------|-----------|---------------------|
| `_import_legacy_exec` | **Setup / one-shot** | prefixo `_`, sem chamadas no código TS | Manter, documentar como ferramenta administrativa |
| `enrich_tuss_em_lote` | **Setup / one-shot** | usado apenas em script de migração de catálogo TUSS | Manter; agendar revisão se ficar 6 meses sem uso |
| `match_tuss_estrito` | **Ativa** | chamada por `enrich_tuss_em_lote` (interno) | Manter |
| `match_tuss_por_nome` | **Ativa** | chamada por `enrich_tuss_em_lote` (interno) | Manter |
| `aplicar_enriquecimento_exame` | **Ativa (setup)** | usada por ferramentas internas de catálogo | Manter |
| `audit_trigger` | **Ativa** | usada por triggers genéricos | Manter |
| `bootstrap_set_cron_secret` | **Setup** | configura segredo cron uma vez por ambiente | Manter |
| `is_super_admin()` / `is_super_admin(_user_id)` | **Ativa (crítica)** | usada por todas as policies de plataforma | Manter |

## Conclusão

Zero RPCs órfãs confirmadas. As "suspeitas" são todas:
- helpers internos chamados por outras RPCs ou triggers, ou
- ferramentas administrativas de setup / migração que devem permanecer disponíveis.
