# Cleanup — Phase 3: Mapa de Legado

Busca por palavras-chave `old|legacy|backup|deprecated|temp|draft|unused`
em nomes de arquivo e por padrões de substituição conhecidos.

## Por nome de arquivo

Nenhum arquivo encontrado contendo `old`, `legacy`, `backup`,
`deprecated`, `temp`, `draft`, `unused` no caminho (excluindo
`node_modules`).

## Por substituição funcional (identificado manualmente)

| Substituído | Substituto canônico | Status |
|---|---|---|
| `src/components/superadmin/NovoTenantDialog.tsx` | Página `src/pages/superadmin/SuperAdminNovoLab.tsx` | Dialog antigo é dead code (0 imports) |
| `src/hooks/use-select-options.ts` | `src/hooks/useDicionario.ts` | Hook antigo é dead code (0 imports) |
| `src/lib/parseValorReferencia.ts` (shim) | `src/domains/result/services/parseValorReferencia.ts` | Shim mantido por retro-compat **(NÃO remover sem buscar todos os consumidores)** |
| Login mock (`admin@sislac.com`) | `LoginV2` + Supabase Auth real | Já removido em hardening anterior — confirmado |
| `Dashboard` legada (cards "Receita do Dia") | `src/pages/Dashboard.tsx` atual | Já removido (memory rule trava reintrodução) |

Nenhum outro candidato “legacy explícito” encontrado.
