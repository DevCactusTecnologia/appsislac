# Engineering Governance — Executive Report

> Relatório final da Missão SISLAC Engineering Governance.
> Sem alteração de código. Apenas auditoria e documentação.

## Sumário executivo

| Indicador | Resultado |
|---|---|
| Regras duplicadas (críticas) | **1** (status financeiro / pagamento) |
| Regras duplicadas (aceitáveis sob vigilância) | **2** (atendimento mirror, preços) |
| Hotspots 🔴 (>1000 LOC) | **11** (todos em allowlist; 4 reduzidos na Sprint 1) |
| Hotspots novos pós-Sprint 1 | **0** |
| Stores globais obrigatórios | **11** justificados |
| Stores candidatos a migração (sem urgência) | **6** |
| Módulos em padrão alvo | **3** (NovoAtendimento, ResultadoDetalhe, Financeiro) |
| Módulos a normalizar | **4** (Mapa, RegistrarColeta, AnalisarAmostra, Index) |
| Service Workers ativos | **0** (removidos na Sprint 0) |
| Vazamentos de timer/realtime | **0** (auditados Sprint 0) |

## 1. Quantas regras duplicadas existem?

**1 crítica** + 2 aceitáveis.

- 🔴 **Status financeiro/pagamento**: replicado em `atendimentoStore`,
  `Financeiro.tsx` e `PagamentoDialog.tsx`. Ação preventiva: extrair
  `src/lib/finance/statusPagamento.ts` quando alguma das 3 for tocada.
- ⚠️ **Status atendimento**: mirror controlado (DB trigger + store optimistic). OK.
- ⚠️ **Precificação**: só no frontend hoje; aceitável até surgir consumidor backend.

Detalhes: `single-source-of-truth-audit.md`.

## 2. Quantos hotspots existem?

**11 arquivos** > 1000 linhas (todos em `scripts/file-size-allowlist.txt`):

- 4 críticos (≥ 2000 LOC) — todos com Sprint 1 já reduzindo
- 1 store congelado (`atendimentoStore` 1514)
- 6 entre 1000–1199 (observação)

Detalhes: `engineering-hotspots.md`.

## 3. Quais stores merecem observação?

| Store | Razão |
|---|---|
| `atendimentoStore` (1514) | 🔴 Congelado — não tocar |
| `auditLogsStore` (411), `auditoriaStore` (216) | 🟠 Candidatos naturais a React Query |
| `sorotecaStore` (676), `rastreabilidadeStore` (451) | 🟡 Podem migrar para queries |
| `convenioFaturasStore`, `estoqueStore`, `mapaTrabalhoStore`, `orcamentoStore` | 🟡 Tela única — podem ser locais |

Nenhuma migração agora. Apenas vigilância.

Detalhes: `state-governance.md`.

## 4. Quais módulos estão fora do padrão?

Padrão = subpasta `<modulo>/` com `page.tsx`, `components/`, `helpers.ts`, `types.ts`.

Fora do padrão (sem urgência):
- `src/pages/Mapa.tsx`
- `src/pages/RegistrarColeta.tsx`
- `src/pages/AnalisarAmostra.tsx`
- `src/pages/Index.tsx`

Migração só quando o arquivo for tocado por demanda.

## 5. Quais ganhos de manutenção foram obtidos?

### Estruturais (Sprint 0+1, já aplicados)
- Service Workers legados removidos (2 arquivos)
- 4 monolitos fatiados (−809 LOC redistribuídas)
- Realtime e timers auditados (cleanup correto)

### Governança (esta missão, documental)
- **6 documentos oficiais** criados em `docs/governance/` + `docs/ENGINEERING_RULES.md`
- Política de tamanho de arquivo formalizada com allowlist no CI
- Classificação de stores (obrigatório vs opcional vs local)
- Estrutura padrão de módulo documentada
- Regra: "antes de criar estado global, responda 3 perguntas"
- Regra: "antes de adicionar lógica no frontend, responda 4 perguntas"

### Ganhos esperados
- **Menos duplicação futura**: novas regras passam por checklist
- **Menos arquivos monolíticos**: alerta automático no CI
- **Menos drift entre camadas**: mirror documentado, fonte canônica explícita
- **Onboarding mais previsível**: módulo padrão = lugar único para procurar
- **Refatorações cirúrgicas**: hotspots conhecidos e priorizados

## Decisão final

**Missão encerrada.** Arquitetura congelada. Voltar ao desenvolvimento normal
de funcionalidades.

Reabrir governança apenas quando:
- Surgir novo hotspot 🔴 fora da allowlist
- Aparecer duplicação crítica não documentada
- Performance do Lovable degradar mensuravelmente

## Critério de sucesso — checklist

- [x] Uma única fonte de verdade por regra (1 exceção documentada)
- [x] Menos lógica distribuída (mapeada e classificada)
- [x] Menos crescimento descontrolado (CI + allowlist)
- [x] Padrão único de módulos (documentado)
- [x] Menos risco futuro (regras permanentes em `ENGINEERING_RULES.md`)
- [x] Código mais previsível (estrutura padronizada)
- [x] Engenharia sustentável (documentação viva)
- [x] Sem regressões (zero código alterado nesta missão)
- [x] Sem nova onda de refatoração (regra de parada respeitada)
