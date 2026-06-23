# Cleanup 1.0 — Fase 4: Saúde de Tamanho de Arquivo

> Documentação. **Nada refatorado.**

Governança vigente: `scripts/check-file-size.sh` (§12 IA_ARCHITECTURE_RULES).
Limites: 🟡 > 600 · 🟠 > 800 · 🔴 > 1000 (bloqueia salvo allowlist).

## Estado atual

- 🔴 > 1000 linhas: **11 arquivos** (todos em allowlist)
- 🟠 > 800 linhas: **18 arquivos**
- 🟡 > 600 linhas: **36 arquivos**

## Vermelhos (allowlist atual)

```
src/components/configuracoes/NovoExameDialog.tsx
src/components/configuracoes/mapas/RichTextEditorPro.tsx
src/data/atendimentoStore.ts             ← já dividido em atendimentoStore/
src/lib/comprovantes.ts
src/pages/AnalisarAmostra.tsx
src/pages/Financeiro.tsx
src/pages/Index.tsx
src/pages/Mapa.tsx
src/pages/NovoAtendimento.tsx
src/pages/RegistrarColeta.tsx
src/pages/ResultadoDetalhe.tsx
```

### Observação importante

`src/data/atendimentoStore.ts` aparece na allowlist mas **já foi dividido**
em `src/data/atendimentoStore/` (index.ts + 7 módulos). A entrada na
allowlist provavelmente é obsoleta — confirmar se o arquivo monolítico
ainda existe ou se a entrada virou letra-morta.

## Laranjas adicionais (800–1000)

- `src/data/sorotecaStore.ts` (830)
- `src/data/sorotecaEstruturaStore.ts` (828)
- `src/pages/Pacientes.tsx` (841)
- `src/pages/Estoque.tsx` (844)
- `src/pages/superadmin/SuperAdminConfiguracoes.tsx` (860)
- `src/components/configuracoes/SiteTab.tsx` (974)
- `src/components/configuracoes/ExamesTab.tsx` (976)
- `src/pages/SorotecaExpurgo.tsx` (981)
- `src/pages/AnalisarAmostra.tsx` (994)

## Recomendação (não executada)

Fila de slicing por prioridade de risco:
1. `NovoAtendimento.tsx` (2.764) — wizard com lógica de preço, exames, paciente.
2. `ResultadoDetalhe.tsx` (2.685) — layout de impressão travado, refatorar com cuidado.
3. `Index.tsx` (1.237) — dashboard/router.
4. `Soroteca.tsx` + `SorotecaEstrutura.tsx` (~2.700 combinados).
