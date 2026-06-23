# Plataforma 2.0 — Fase 15: Relatório Executivo

**Modo:** auditoria somente leitura. **Data:** 2026-06-23.

## Números absolutos

| Indicador | Valor |
|-----------|------:|
| Tabelas (`public`) | **116** |
| Views | **13** |
| RPCs/Funções | **190** |
| Triggers (distintos) | **192** |
| Policies RLS | **366** |
| Índices | **465** |
| Migrations | **292** |
| Tamanho do banco | **47.4 MB** |

## Respostas diretas

1. **O banco está saudável?** → **Sim.** DB e PgBouncer up, 0 restarts, 16/60 conexões, disco 17 %. Memória em 65 % (atenção) e rollbacks acumulados em 189 401 (atenção).
2. **Existe legado estrutural?** → **Pouco.** Categorias texto em `exames_catalogo`, possível `exames_publicos` (tabela) vs view, e auditoria com forwarders redundantes.
3. **Existe schema morto?** → Não há tabelas mortas. ~8 funções suspeitas.
4. **Migrations redundantes?** → Sim — ~120 correções/hotfixes consolidáveis em baseline futuro.
5. **Índices inúteis?** → 265 com `idx_scan = 0`, mas a maioria por PK em tabela vazia ou base imatura. Reavaliar em 30 dias.
6. **RPCs órfãs?** → 0 confirmadas; ~26 candidatas a revisão.
7. **Tabelas órfãs?** → **0**.
8. **Débito técnico escondido?** → **Moderado:**
   - 7 views `SECURITY DEFINER` (linter ERROR).
   - ~50 funções `SECURITY DEFINER` sem `search_path` fixo.
   - Lista `pacientes` PostgREST sem índice de ordenação adequado.
   - Polling de `documento_templates`.
9. **Existem duplicações?** → 3 reais (auditoria, categoria/setor, exames_publicos tabela/view).
10. **Vale a pena baseline futuro?** → **Sim**, em ~30 dias de estabilidade. Pode reduzir 292 → ~45 migrations.

## Domínios mais complexos
Multi-tenant/SaaS (14 tabelas) e Integrações (14 tabelas).

## Domínios mais simples
Geo (2), Pacientes (3), Equipe (3), Resultados (3).

## Classificação geral

| Eixo | Nota |
|------|------|
| Estrutura | **Boa** (RLS 100 %, isolamento tenant correto) |
| Segurança | **Boa → Regular** (7 ERRORS de linter; corrigíveis pontualmente) |
| Performance | **Boa** com 2 pontos de atenção (pacientes/documento_templates) |
| Manutenibilidade | **Regular** (292 migrations pedem baseline) |
| Duplicação | **Boa** (3 itens conhecidos) |
| Código morto | **Boa** (~8 funções) |

## Veredito final

### Estado real da plataforma: **BOA**

Justificativa técnica:
- Isolamento multi-tenant íntegro (RLS em 100 % das tabelas, 366 policies coerentes).
- Domínios funcionais já passaram por auditoria 2.x (WhatsApp, Soroteca, Estoque, Equipe, Exames).
- Zero tabelas e zero views órfãs.
- Débito conhecido e contido (security definer views, search_path mutável, alguns indexes a reavaliar).
- Volume de migrations é o único item que separa "Boa" de "Excelente".

## Próximos passos (recomendados, não executados)

1. Resolver 7 ERRORS do linter Supabase (Security Definer Views).
2. Fixar `search_path` em funções SECURITY DEFINER (WARN).
3. Otimizar listagem de pacientes (índice + cursor) e cache de `documento_templates`.
4. Auditoria fina das ~26 RPCs candidatas.
5. Em 30 dias, decidir sobre **Baseline 1.0** (~45 migrations).

## REGRA DE PARADA

✅ Auditoria concluída.
🚫 Nenhuma alteração feita.
🚫 Nenhum baseline criado.
🚫 Sem consolidação, sem remoção, sem otimização.

**Aguardando aprovação explícita para próxima fase.**
