# 08 — Readability Analysis

## Nomenclatura
- Convenções uniformes: `*Store.ts`, `use*.ts(x)`, `super-admin-*`, `integration-*`, `_shared/*`, `*Dialog.tsx`, `*Panel.tsx`, `*Tab.tsx`.
- Verbos claros nas edges (nome do diretório = missão).
- Domínio em português (SISLAC) em `pages/`, `data/`, `domains/`; infraestrutura em inglês (`runtime`, `lib`, `hooks`).

## Organização
- `src/` segue camadas: `pages/`, `components/`, `data/`, `domains/`, `hooks/`, `lib/`, `runtime/`, `integrations/`, `contexts/`.
- Auditorias formais versionadas em `docs/technical-audit/phase-XX-*` (10 fases anteriores).

## Convenções
- ESLint com regras estritas de import (`no-restricted-imports`) forçam Runtime 2.0.
- Guards CI em `scripts/check-*.sh`.
- `scripts/file-size-allowlist.txt` documenta arquivos grandes conhecidos.

## Comentários
- Presença de comentários explicativos em `eslint.config.js`, `_shared/runtime/*`, `contexts/AuthContext.tsx`.
- 66 TODO/FIXME/HACK/XXX totais — baixa densidade (~0,05/100 LOC).

## Documentação
- 247 arquivos `.md` em `docs/**`.
- `src/BEST_PRACTICES.md` presente.
- `.lovable/mem/**` documenta features/constraints operacionais.

## Tipagem
- `noImplicitAny: true`, `strictNullChecks: true` em `tsconfig.json`.
- 0 usos de `any` isolado (todos qualificados como `as any`).
- 65 `as any` distribuídos em ~20 arquivos — concentrados em edges de super-admin e integrações.
- 7 `@ts-ignore/@ts-expect-error/@ts-nocheck`.
- 48 `eslint-disable` em ~20 arquivos.

## Consistência
- Alta em nomenclatura e organização.
- Média em tamanho de arquivo (25 arquivos > 800 LOC destoam do padrão modular).
