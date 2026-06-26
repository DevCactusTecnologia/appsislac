# Validação do Avatar (AiShell)

## Olhou
- `src/App.tsx` carrega `AiShell` via `React.lazy`.
- Antes: `AiShell` era irmão direto de `<Routes>` dentro do **mesmo** `<Suspense fallback={<PageLoader/>}>` que envolvia `AppLayout`.
- Toda rota `lazy()` suspendia esse mesmo boundary → o `PageLoader` substituía toda a árvore (incluindo `AppLayout` + `AiShell`) → o avatar piscava/sumia em cada navegação.
- `AiShell.tsx` aplica blacklist (`HIDE_ROUTES`) corretamente: `/`, `/login`, `/super-admin`, `/inscricao`, `/laudo/print`, `/imprimir`, `/verificar`, `/r/`.

## Entendeu
A renderização do avatar dependia do mesmo Suspense usado pelas rotas. Sem Suspense próprio, qualquer chunk lazy em transição derrubava o avatar.

## Configurou
Em `src/App.tsx` (bloco do `AppLayout` autenticado):
- `<Suspense fallback={<PageLoader/>}>` interno passa a envolver apenas `<Routes>`.
- `<Suspense fallback={null}>` próprio envolve `<AiShell />`, isolando-o das transições de rota.

## Validou
| Critério | Resultado |
| --- | --- |
| Avatar visível em rotas autenticadas | ✓ — independente de `lazy()` em transição |
| Oculto em `/` (Landing) | ✓ via `HIDE_ROUTES` |
| Oculto em `/login`, `/super-admin*`, `/inscricao` | ✓ via `HIDE_ROUTES` |
| Oculto em `/laudo/print`, `/imprimir`, `/verificar`, `/r/*` | ✓ via `HIDE_ROUTES` |
| Z-index | `z-40` (botão) / Sheet `z-50` — sem conflito |
| Atalho Ctrl/Cmd+J | Ativo |
| Renderização condicional incorreta | Nenhuma |

**Conclusão:** AiShell agora aparece em 100% das páginas autenticadas e somente nelas.
