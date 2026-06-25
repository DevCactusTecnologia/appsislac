# Código Morto / Legado — Valores de Referência

## Banco

| Item | Status | Recomendação |
|---|---|---|
| `valores_referencia.critico_min` / `critico_max` | **0 linhas usando** após meses do release | Avaliar: manter (planejado) ou remover. |
| `exame_parametros.valor_referencia` (texto livre) | Coexiste com `valores_referencia.descricao` | Deprecar após migração. |
| `exame_parametros.qtd_caracteres` | Sem consumidor evidente | Marcar legado. |
| `exame_parametros.exibir_anterior` | Sem consumidor | Legado. |
| `exame_parametros.obrigatorio` | Não bloqueia validação | Legado. |

## Código

| Arquivo | Observação |
|---|---|
| `src/domains/result/services/parseValorReferencia.ts` | Parser heurístico para importar texto legado. Útil para migração one-shot; após Fase 2, candidato a remoção. |
| `src/pages/admin/AuditoriaVR.tsx` | Página de diagnóstico — não está no menu padrão. Manter como utilitário admin. |
| `src/components/configuracoes/FiltrosPorPerfil.tsx` (439 linhas) | Tem grande sobreposição com `FiltrosDialog.tsx`. Validar se ainda é usado. |
| `src/data/reguasEtariasStore.ts` (localStorage) | Suficiente para protótipo; deve virar tabela. |

## Réguas presets em código

Embutidas em `reguasEtariasStore.ts` (`sys:pediatrica-sysmex`, `sys:adulto-unico`). Devem virar seed.

## Conclusão

Há pouco código completamente morto, mas há **bastante código legado coexistindo com a nova matriz** — gera ambiguidade, não bug.
