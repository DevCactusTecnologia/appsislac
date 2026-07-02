# 09 — Functional Complexity

## Métricas (agregadas das Fases 01–03)

| Dimensão | Volume |
|---|---|
| Módulos funcionais | 20 |
| Fluxos ponta-a-ponta | ~10 principais + 11 sequências operacionais |
| Regras de negócio catalogadas | 80+ |
| Máquinas de estado | ~17 |
| Estados totais | ~65 |
| Eventos catalogados | 60+ |
| Pontos de decisão | ~30 (fluxo + auditoria) |
| Edge functions | 74 |
| Migrations | 355 |
| LOC `src/` | ~124.9k |
| LOC edge functions | ~16.3k |

## Origem da complexidade

| Origem | Evidência | Peso relativo |
|---|---|---|
| Domínio laboratorial (RDC/LGPD, coleta, análise, laudo, auditoria dupla) | Regras LEG/BPL/DOM concentradas em Atendimento/Amostra/Resultado/Laudo | Alto — inevitável |
| Multi-tenant + SaaS (RLS, tenant resolution, super admin, migração) | 4 policies RLS por tabela, `tenant_registry`, `runtime_mode`, `tenant_migration_*` | Alto — decisão de produto |
| Integrações externas (lab apoio, WhatsApp, PIX) | circuit breaker, dead-letter, outbox | Médio — reliability |
| Configurabilidade por tenant | `tenant_lab_config`, `notification_policy`, layouts, templates | Médio — natureza SaaS |
| Plataforma IA | tools + approval + audit | Baixo — opcional |
| UX / DX | Ctrl+K, dashboards, mapa | Baixo |

**Veredito de complexidade:** a maior parte da complexidade decorre de (a) regulação e boas práticas de laboratório e (b) da decisão arquitetural de ser SaaS multi-tenant com migração para banco dedicado. Complexidade de implementação pura (fora domínio/produto) concentra-se em integrações e migração — áreas onde padrões conhecidos (outbox, breaker, orquestração de fases) justificam o custo.
