# Phase 16 — Deep File-by-File Audit

Escopo: `src/**`, `supabase/functions/**`, `scripts/**`, `public/**`, `.sh`, `.md`, `.js`, `.ts`, `.svg`, `.xml`.
Método: varredura por LOC, densidade de dívida (`as any`, `TODO`, `eslint-disable`), duplicações, órfãos e coerência com stack real (Vite/React, não Next).

---

## 1. ARQUIVOS ÓRFÃOS / RESÍDUOS (remover ou justificar)

| Arquivo | Tamanho | Motivo | Ação |
|---|---|---|---|
| `next.config.js` | 4.7 KB | Projeto é **Vite** — Next não é usado; esse arquivo nunca é lido | **DELETAR** |
| `GUIA-FINAL-DEPLOYMENT.md` | 6.2 KB | Doc solta na raiz, duplicada por `docs/` | Mover p/ `docs/legacy/` ou apagar |
| `GUIA_COMPLIANCE_IMPLEMENTACAO.md` | 4.9 KB | idem | idem |
| `LGPD_RDC_MIGRACAO_AUTOMATICA.md` | 3.4 KB | idem | idem |
| `public/placeholder.svg` | 3.2 KB | Placeholder default do template Lovable, não referenciado | **DELETAR** |
| `deploy-compliance.sh` (286L) | — | Script de deploy referenciando ambiente que não é o atual | Revalidar/remover |
| `src/BEST_PRACTICES.md` (12.5 KB) | — | Doc dentro de `src/`, quebra separação | Mover p/ `docs/` |

**Impacto:** ~35 KB de ruído + risco de dev seguir doc obsoleta.

---

## 2. RUNTIME DEDICATED — CÓDIGO SEM CONSUMIDOR (confirmado)

Grep confirma: `runtime/identity` e `tenant-dedicated-login-gate` / `tenant-resolve` **não são referenciados** por nenhum arquivo em `src/`. Alinhado com forensic-review.

| Item | Ação |
|---|---|
| `supabase/functions/tenant-dedicated-login-gate/` | Remover se não houver plano de ativação em ≤30 dias |
| `supabase/functions/tenant-resolve/` | idem |
| `src/runtime/identity/*` (se existir) | Remover |

---

## 3. DUPLICAÇÃO EM EDGE FUNCTIONS

**27 edges declaram `const corsHeaders` local** em vez de importar de `_shared/`. Duplicação pura.

| Métrica | Valor |
|---|---|
| Edges com `corsHeaders` | 29 |
| Edges que **duplicam** a constante | **27** |
| LOC economizável | ~5 por edge = 135 LOC |

**Ação:** substituir todas por `import { corsHeaders } from "../_shared/cors.ts"`.

---

## 4. ARQUIVOS GIGANTES (violam "simples e funcional")

Regra proposta: **≤ 500 LOC por arquivo de page/component**.

### CRÍTICO (>1500 LOC)
| Arquivo | LOC | Problema |
|---|---|---|
| `src/pages/ResultadoDetalhe.tsx` | **3.129** | Página monolítica: laudo + auditoria + assinatura + impressão + histórico + gráficos |
| `src/pages/NovoAtendimento.tsx` | **2.829** | Wizard + pricing + pagamento + PIX + orçamento |
| `src/pages/SorotecaEstrutura.tsx` | 1.456 | UI + regras de negócio + drag&drop |
| `src/pages/Index.tsx` | 1.310 | Provavelmente landing legada — verificar necessidade |
| `src/pages/superadmin/SuperAdminTenantDetalhe.tsx` | 1.259 | 6 abas em 1 arquivo |
| `src/pages/Soroteca.tsx` | 1.245 | idem estrutura |
| `src/pages/RegistrarColeta.tsx` | 1.215 | UI + regras + realtime |

### ALTO (800–1500 LOC)
Financeiro, Mapa, AnalisarAmostra, SorotecaExpurgo, ExamesTab, SiteTab, ValoresReferenciaPanel, ParametrosDialog, Usuarios, PagamentoDialog, SuperAdminConfiguracoes, Pacientes, Dashboard, Estoque, TenantDatabaseConfig, sorotecaStore, sorotecaEstruturaStore.

**Plano de split padrão** (aplicável às 4 primeiras já provadas em `NovoAtendimento/`):
```
Página.tsx (≤300)   → orquestra state + render
├── components/     → subseções UI
├── hooks/          → useForm, useSubmit, useRealtime
└── services/       → regra de negócio pura, testável
```

---

## 5. DÍVIDA CONCENTRADA

| Arquivo | Nº `as any` / eslint-disable | Ação |
|---|---|---|
| `src/lib/queryPatterns.ts` | 11 `as any` | Tipar corretamente com generics |
| `src/domains/result/services/comprovantesRender.ts` | 8 eslint-disable + 4 `as any` | Refatorar tipos |
| `supabase/functions/ai-chat/skills/resultado.ts` | 8 `: any` | Tipar payloads |
| `src/pages/Financeiro/FinanceiroContext.tsx` | 8 `: any` | Substituir por `types.ts` |
| `src/data/auditoriaStore.ts` | 6 `: any` + 3 `as any` | Tipar |

**Sem `console.log` em produção** — bem.

---

## 6. TESTES: COBERTURA CRÍTICA BAIXA

| Métrica | Valor |
|---|---|
| Arquivos em `src/` | ~469 |
| Test specs | **11** |
| Ratio | 2.3% |

Sugestão mínima para 60 dias:
- `src/lib/pixBrCode.ts` — teste unitário puro
- `src/domains/appointment/services/pricing.ts` — regra crítica de cobrança
- `src/pages/ResultadoDetalhe/formula.ts` — já tem, expandir
- `src/data/atendimentoStore/mutations.ts` — smoke via mock supabase
- Edge `create-atendimento` e `super-admin-migrate-*` — contract tests

---

## 7. SCRIPTS DE ROOT

| Script | LOC | Situação |
|---|---|---|
| `scripts/test-rls.js` | 346 | Mock puro, sem valor real. Substituir por integration |
| `scripts/test-rls-integration.js` | 324 | ✅ Executa contra Supabase real. Manter |
| `scripts/test-validacoes.js` | 347 | Validações duplicadas de `src/lib/*` | Migrar para vitest e apagar |
| `scripts/backup-sql.ts` | 101 | ✅ Útil, manter |
| `scripts/check-*.sh` (3) | 203 total | ✅ Guards do CI, manter |
| `deploy-compliance.sh` | 286 | Revisar aplicabilidade |

---

## 8. INTEGRAÇÃO SUPABASE — GOVERNANÇA CORRETA

✅ **0 arquivos** importam `@/integrations/supabase/client` diretamente em `src/` (todos passam pelo `runtime/db.ts`). O guard funciona.
✅ `types.ts` (272 KB) é auto-gerado, não conta como dívida.

---

## 9. ARQUIVOS PÚBLICOS

| Arquivo | Status |
|---|---|
| `public/robots.txt` | ✅ OK |
| `public/sitemap.xml` | ✅ OK (edge `sitemap` também gera dinâmico) |
| `public/llms.txt` | ✅ Bom para SEO IA |
| `public/placeholder.svg` | ❌ Órfão do template |

---

## 10. RESUMO EXECUTIVO — AÇÕES PRIORIZADAS

### Quick wins (< 1 dia)
1. Deletar `next.config.js`, `public/placeholder.svg`, 3 `.md` da raiz.
2. Consolidar `corsHeaders` em `_shared/cors.ts` → -135 LOC em edges.
3. Mover `src/BEST_PRACTICES.md` para `docs/`.
4. Remover edges `tenant-dedicated-login-gate` e `tenant-resolve` se sem plano.

### Refatoração média (5–10 dias)
5. Split de `ResultadoDetalhe.tsx` (3.129 LOC) — maior ganho de manutenibilidade.
6. Split de `NovoAtendimento.tsx` (2.829 LOC) — segundo maior ganho.
7. Tipar `queryPatterns.ts` e `comprovantesRender.ts`.

### Estrutural (30 dias)
8. Aplicar regra ESLint `max-lines: 500` como warning e migrar top 10 gigantes.
9. Elevar cobertura de teste para 20% focando em serviços críticos.
10. Consolidar docs em `docs/INDEX.md` e apagar duplicatas de raiz.

---

## Métricas alvo pós-cirurgia

| Métrica | Hoje | Alvo |
|---|---|---|
| Arquivos > 800 LOC | 24 | ≤ 5 |
| Arquivos > 1500 LOC | 7 | 0 |
| `as any` em `src/` | ~65 | ≤ 20 |
| Edges duplicando corsHeaders | 27 | 0 |
| .md na raiz | 4 | 1 (README) |
| Órfãos identificados | 7 | 0 |
| Cobertura testes | 2.3% | ≥ 20% |

STATUS: **DIAGNÓSTICO COMPLETO. AGUARDANDO AUTORIZAÇÃO PARA EXECUTAR.**
