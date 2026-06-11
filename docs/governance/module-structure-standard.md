# Module Structure Standard

> Fase 5 — Padrão único para novos módulos.

## Estrutura alvo

```
src/pages/<modulo>/
  page.tsx              # orquestrador (até 800 linhas)
  components/           # subcomponentes específicos da página
  hooks/                # hooks específicos da página
  services/             # chamadas Supabase/RPC tipadas
  types.ts              # tipos públicos do módulo
  helpers.ts            # funções puras (formatação, derivação)
```

## Regras

1. **`page.tsx` é orquestrador.** Sem regra de negócio, sem JSX gigante.
2. **`components/` é interno.** Componentes reutilizáveis cross-módulo vão para `src/components/`.
3. **`services/`** encapsula `supabase.from(...)` — telas não chamam supabase direto.
4. **`types.ts`** declara contratos públicos; `helpers.ts` exporta puras.
5. **Sem `index.ts` barrel** dentro do módulo (evita ciclos).

## Módulos já em conformidade

- `src/pages/NovoAtendimento/` — ✅ helpers, types, components
- `src/pages/ResultadoDetalhe/` — ✅ helpers, types, components
- `src/pages/Financeiro/` — ✅ helpers, types

## Módulos a normalizar (sem urgência)

- `src/pages/RegistrarColeta.tsx` (1129) — sem subpasta
- `src/pages/AnalisarAmostra.tsx` (1002) — sem subpasta
- `src/pages/Mapa.tsx` (1146) — sem subpasta
- `src/pages/Index.tsx` (1158) — sem subpasta

## Migração

Migrar **apenas quando o arquivo for tocado** por outra demanda. Não fazer
slicing especulativo. Cada migração:

1. Cria subpasta `<modulo>/`.
2. Move `types`, `helpers` puros, componentes locais.
3. Mantém `page.tsx` como orquestrador.
4. Preserva imports externos (compat).
