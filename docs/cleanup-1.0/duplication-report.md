# Cleanup 1.0 — Fase 3: Duplicação e Sobreposição

> Documentação. **Nada consolidado.**

## Duplicação real (dois arquivos com o mesmo papel)

| A | B | Resolução atual |
|---|---|-----------------|
| `src/lib/parseValorReferencia.ts` (250 B, shim) | `src/domains/result/services/parseValorReferencia.ts` (4,9 KB, fonte) | Shim re-exporta. SSOT = domains. |
| `src/lib/criticoChecker.ts` (298 B, shim) | `src/domains/result/services/criticoChecker.ts` (1,7 KB, fonte) | Shim re-exporta. SSOT = domains. |
| `src/data/_tenant.ts` (proxy) | `src/lib/db/tenantResolver.ts` (fonte) | Proxy com 10 consumidores. TODO marcado. |

## Padrões duplicados (de auditorias anteriores, ainda válidos)

- Listener HID `keydown` global duplicado em `Soroteca.tsx` e `SorotecaTriagem.tsx`
  (`docs/soroteca-audit/dead-code-report.md`).
- Regra "material não reutilizável" hardcoded em `sorotecaStore.ts` e `Producao.tsx`
  — deveria ler `materiais_amostra.reutilizavel` (idem).
- Bloqueio de empréstimo ativo: lógica client em `sorotecaStore.ts` + RPC
  `amostra_em_emprestimo_ativo` não consumida (idem).

## Stores que possivelmente se sobrepõem

| Store | Domínio | Observação |
|-------|---------|------------|
| `convenioStore.ts` | Convênios | Catálogo |
| `convenioFaturasStore.ts` | Convênios | Faturas |
| `convenioGlosasStore.ts` | Convênios | Glosas |
| `convenioCompetenciasStore.ts` | Convênios | Competências |
| `financeiroStore.ts` | Financeiro | Saídas |
| `financeiroListasStore.ts` | Financeiro | Listas auxiliares |
| `caixaSessoesStore.ts` | Financeiro | Caixa |
| `sorotecaStore.ts` | Soroteca | Amostras |
| `sorotecaEstruturaStore.ts` | Soroteca | Estrutura física |
| `sorotecaExpurgoStore.ts` | Soroteca | Expurgo |

Sem duplicação real — separação por responsabilidade. Mantém-se.

## Conclusão

Duplicação verdadeira hoje resume-se a **3 shims com 0 lógica**
(re-export puro). Demais "duplicações" são padrões repetidos cuja
consolidação foi adiada — todos já documentados nas auditorias
específicas (`soroteca-audit/dead-code-report.md`,
`exames-2.3/material-consumers-audit.md`).
