# AI Shell — Avatar Global

## Princípio
Um único ponto de entrada visual da IA, presente em todas as páginas autenticadas, **sem ocupar área útil** e **sem rota dedicada**. O avatar é um portal, não uma página.

## Posicionamento
- Componente montado no `AppShell` (após `<Outlet/>`), nível de `Toaster`.
- Botão flutuante: `fixed bottom-4 right-4`, `z-40`, `40x40px`, ícone `Sparkles`, cor `primary` (#4D41F3).
- Quando minimizado: badge numerado se houver sugestões proativas pendentes.
- Atalho de teclado oficial: **Ctrl/Cmd + J** abre o painel; **Esc** fecha.

## Painel
- Drawer lateral à direita (`Sheet` shadcn), largura `420px` desktop, `100vw` mobile.
- Não bloqueia interação com a página (overlay translúcido, click-outside fecha).
- Header: nome curto ("Assistente"), status (online/streaming/erro), botão minimizar e fechar.
- Body: lista de mensagens (markdown via `react-markdown`), tool calls renderizadas como cards compactos com status (pending/running/success/error), botões de confirmação para ações `needsApproval`.
- Composer: input multiline auto-resize, enviar com Enter (Shift+Enter = nova linha), botão stop durante streaming.
- Footer: chips de "ações sugeridas" derivadas do contexto atual.

## Estados visuais
| Estado | Aparência |
|---|---|
| Oculto | Sem botão (rotas públicas `/`, `/login`, `/inscricao`) |
| Idle | Botão flutuante discreto |
| Sugestão proativa | Botão com badge numérico + tooltip "1 sugestão" |
| Streaming | Painel aberto, indicador de tokens |
| Erro | Toast com mensagem do gateway (429/402/etc.) |

## Mobile
- Botão move para `bottom-20 right-4` (acima da bottom bar quando existir).
- Painel vira fullscreen.
- Sem atalho de teclado; gesto: swipe-up no botão abre.

## Onde NÃO aparece
- Landing pública (`/`).
- Login (`/login`, `/super-admin`).
- Inscrição (`/inscricao`).
- Telas de impressão (`/laudo/print/*`, `/imprimir/*`) — atrapalha o A4.
- Páginas em fullscreen explícito (regra: `data-ai-shell="off"` no container raiz).

## Tema
- Usa apenas tokens semânticos do `index.css` (primary, background, border, muted-foreground).
- Sem gradientes, sem sombras, raio 8px (`rounded-lg`).
- Respeita dark mode automaticamente.

## Notificações proativas
- O Context Engine pode emitir "hints" leves (ex.: "3 resultados parados há >24h"); o AI Shell incrementa o badge.
- Limite: máximo 3 hints simultâneos; nunca push intrusivo (sem toast, sem modal).

## Anti-padrões proibidos
- Criar rota `/agent` ou `/ai`.
- Usar `useNavigate()` para mover o usuário sem confirmação.
- Abrir modal por cima de modal.
- Reproduzir áudio sem ação explícita.
- Persistir estado de UI no localStorage entre tenants.
