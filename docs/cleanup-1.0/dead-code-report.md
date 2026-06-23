# Cleanup 1.0 — Fase 2: Código Morto e Arquivos Órfãos

> Documentação apenas. **Nada removido.**

## Arquivos órfãos (sem importador no projeto)

Heurística: arquivo `.ts/.tsx` em `src/` cujo basename não aparece em
nenhum outro arquivo `.ts/.tsx`. Excluídos: `main.tsx`, `App.tsx`,
`src/integrations/supabase/*`, `src/test/*`, `vite-env.d.ts`.

| Arquivo | Tipo | Notas |
|---------|------|-------|
| `src/components/inscricao/LocationSelector.tsx` | Componente | Provável uso removido após simplificação de inscrição |
| `src/components/superadmin/SubscriptionStatusBadge.tsx` | Componente | Badge não consumido |
| `src/components/ui/date-picker.tsx` | shadcn | shadcn não consumido (apps usam Input native) |
| `src/components/ui/tabs.tsx` | shadcn | shadcn não consumido |
| `src/data/selectOptionsStore.ts` | Store | Possível false-positive — verificar acessos via barrel/dynamic |
| `src/domains/result/services/ParameterRulesService.ts` | Service | DDD prep — sem consumidor |
| `src/integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts` | Service | Provider service não plugado |
| `src/lib/whatsapp/getBestWhatsappAction.ts` | Util | Helper sem consumidor |
| `src/pages/NovoAtendimento/buildExamesCobranca.test.ts` | Teste | Suite de teste — não importada (executada por vitest, ok) |
| `src/pages/NovoAtendimento/pricing.test.ts` | Teste | idem |
| `src/pages/NovoAtendimento/services/aplicarAjusteLiquido.test.ts` | Teste | idem |

**Total**: 11 candidatos. **8 reais** (testes não contam).

## Pastas vazias estruturais (DDD futuro)

32 `.gitkeep` em `src/domains/{appointment,auth,exam,finance,notification,patient,print,result,tenant}/{repositories,services,types,validators}`.
Apenas 9 arquivos `.ts` reais existem em `src/domains/**`. As demais 32 subpastas estão preparadas mas vazias.

## Proxy/shim files (retro-compat)

| Arquivo | Função | Status |
|---------|--------|--------|
| `src/lib/parseValorReferencia.ts` | Re-export para `@/domains/result/services/parseValorReferencia` | Shim — migrar call sites |
| `src/lib/criticoChecker.ts` | Re-export para `@/domains/result/services/criticoChecker` | Shim — migrar call sites |
| `src/data/_tenant.ts` | Proxy para `@/lib/db/tenantResolver` (10 consumidores) | TODO marcado no próprio arquivo |

## Marcadores no código

| Marcador | Ocorrências |
|----------|---:|
| `TODO` / `FIXME` / `DEPRECATED` / `@deprecated` | 57 |
| `legado` / `legacy` / `deprec` | 134 |
| `console.log/warn/error/debug` | 24 |
| `eslint-disable` (arquivos) | 27 |

## Migrations potencialmente substituídas

Per `docs/plataforma-2.0/migrations-audit.md`: ~25 migrations "legado" que criaram
objetos posteriormente descartados (Exames 2.1, sync triggers Exames 2.3,
WhatsApp 3B drop legacy). Lista detalhada permanece naquele relatório.

## RPCs/funções suspeitas de não-uso

Per `docs/plataforma-2.0/dead-database-code.md`: ~8 funções
(`_import_legacy_exec`, `enrich_tuss_em_lote`, `match_tuss_estrito`,
`match_tuss_por_nome`, `aplicar_enriquecimento_exame`, `audit_trigger`
genérica, `bootstrap_set_cron_secret`, `is_super_admin()` sem args).
**Nada removido.**

## Recomendação

Volume baixo em valor absoluto (8 arquivos reais + 32 .gitkeep + 3 shims).
Justifica uma **Fase 2 de Cleanup execução** com aprovação explícita —
não realizada agora.
