# Cleanup 1.0 — Relatório Executivo

> Radiografia completa de arquivos, pastas e código.
> **Nada removido. Nada renomeado. Nada consolidado.**

## Pergunta-guia

> "O que existe? O que é usado? O que é morto? O que é duplicado?
> O que é dívida visível?"

## Saúde geral do código-fonte

| Indicador | Valor | Classificação |
|---|---:|---|
| Arquivos `.ts/.tsx` em `src/` | 453 | ✅ |
| Linhas em `src/` | 103.546 | ⚠️ Alto, esperado para SaaS multi-domínio |
| Arquivos > 1000 linhas (bloqueio) | 11 (todos em allowlist) | ⚠️ Dívida controlada |
| Arquivos órfãos reais | **8** | ✅ Baixíssimo |
| Pastas vazias DDD (`.gitkeep`) | 32 | ℹ️ Preparação futura |
| Shims de retro-compat | 3 | ✅ Mínimo |
| Marcadores `TODO/FIXME/DEPRECATED` | 57 | ✅ Aceitável |
| `console.log` em produção | 24 | ⚠️ Limpar pontualmente |
| `eslint-disable` (arquivos) | 27 | ✅ Aceitável |
| Migrations | 294 | ℹ️ Ver `plataforma-2.0/migrations-audit.md` |
| Documentos `.md` | 184 (740 KB) | ✅ Auditável, sem ruído |

## Diagnóstico por dimensão

### 🟢 Saudável
- **Estrutura modular** — 24 sub-pastas em `components/`, separação clara
  pages/data/lib/hooks/contexts/integrations.
- **Stores enxutos** — 41 stores cada com responsabilidade única.
- **Documentação histórica** — 21 pastas de fase, 184 .md, todos
  rastreáveis ao programa de modernização.
- **Edge functions** — 54 funções organizadas (super-admin-*, whatsapp-*,
  ai-* etc.).
- **Migrations RLS** — 100% cobertura (per Plataforma 2.0).

### 🟡 Dívida controlada
- **11 arquivos > 1000 linhas** com allowlist explícita justificada.
  Maiores: `NovoAtendimento.tsx` (2.764), `ResultadoDetalhe.tsx` (2.685).
- **32 `.gitkeep`** em `src/domains/**` — preparação DDD não exercida.
- **3 shims de re-export** (`src/lib/parseValorReferencia.ts`,
  `src/lib/criticoChecker.ts`, `src/data/_tenant.ts`).
- **`atendimentoStore.ts` na allowlist** mas já dividido em
  `atendimentoStore/` — entrada provavelmente obsoleta.

### 🟡 Cleanup oportunístico (8 arquivos órfãos)
1. `components/inscricao/LocationSelector.tsx`
2. `components/superadmin/SubscriptionStatusBadge.tsx`
3. `components/ui/date-picker.tsx` (shadcn não usado)
4. `components/ui/tabs.tsx` (shadcn não usado)
5. `data/selectOptionsStore.ts` (verificar antes — possível false-positive)
6. `domains/result/services/ParameterRulesService.ts`
7. `integrations/providers/hermes-pardini/services/verificarRecebimento.service.ts`
8. `lib/whatsapp/getBestWhatsappAction.ts`

### 🟠 Atenção
- **`hero-flower.png`** = 810 KB. Único asset binário grande.
  Compressão/CDN traria ganho de bundle.
- **`docs/financeiro-audit/` + `docs/financeiro/`** e
  **`docs/soroteca-audit/` + `docs/soroteca-2.0/`** — pares
  auditoria/execução com potencial de fusão futura.

### 🔴 Riscos
Nenhum risco crítico identificado por esta radiografia.
Toda dívida é controlada, documentada e tem rota de saída.

## Relatórios desta fase

1. `docs/cleanup-1.0/inventory-report.md` — Inventário completo.
2. `docs/cleanup-1.0/dead-code-report.md` — Arquivos órfãos e marcadores.
3. `docs/cleanup-1.0/duplication-report.md` — Duplicação e shims.
4. `docs/cleanup-1.0/file-size-report.md` — Saúde de tamanho.
5. `docs/cleanup-1.0/docs-audit.md` — Documentação por fase.
6. `docs/cleanup-1.0/assets-audit.md` — Binários e public.
7. `docs/cleanup-1.0/executive-report.md` — Este sumário.

## Veredito

> **Estado do código-fonte SISLAC: BOM.**
>
> O projeto é grande (103k LOC, 453 arquivos), maduro
> (294 migrations, 184 documentos), modular (24 subdomínios) e
> com pouquíssima sujeira real (8 órfãos, 3 shims, 0 risco crítico).
>
> A dívida visível está concentrada em **11 page-monólitos** já
> conhecidos e governados por allowlist, e em **32 subpastas DDD
> vazias** preparadas para expansão futura.

## Regra de parada

**PARAR.** Não remover. Não consolidar. Não refatorar.
Aguardar aprovação explícita para Cleanup 1.1 (Execução).
