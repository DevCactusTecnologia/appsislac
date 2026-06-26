# AI Shell — Assistente Operacional do SISLAC

> O AI Shell **não é um chat**. É o **Assistente Operacional** do laboratório. Tem cara de SISLAC, vocabulário de SISLAC, e abre direto em **Modo Assistente** (ver `assistant-mode.md`).

## Princípio
Um único ponto de entrada visual da IA, presente em todas as páginas autenticadas, **sem ocupar área útil** e **sem rota dedicada**. O Avatar é um portal para executar ações, não um espaço de conversa.

## Identidade visual (parte do SISLAC, não um chatbot)
- **Nome interno e exibido**: "Assistente" (nunca "Chat", "IA", "Bot", "Copilot").
- **Ícone**: `Sparkles` da Lucide na cor `primary` (#4D41F3) — mesma família visual do restante do sistema.
- **Tipografia**: Inter, mesma do app. Sem fonte distinta.
- **Tokens**: apenas semânticos do `index.css` (primary/background/border/muted-foreground). Sem gradiente, sem sombra extra, raio 8px.
- **Aria-label**: `Assistente SISLAC`.
- **Tooltip do botão**: "Assistente • Ctrl+J".

## Posicionamento
- Montado no `AppShell` após `<Outlet/>`, nível de `Toaster`.
- Botão flutuante: `fixed bottom-4 right-4`, `z-40`, `40x40px`.
- Quando minimizado: badge numerado se houver sugestões proativas pendentes.
- Atalho oficial: **Ctrl/Cmd + J** abre; **Esc** fecha.

## Painel
- Drawer lateral à direita (`Sheet` shadcn), largura `420px` desktop, `100vw` mobile.
- Não bloqueia interação com a página (overlay translúcido, click-outside fecha).
- Header: "Assistente" + status discreto (online/streaming/erro) + minimizar/fechar.
- **Body abre sempre em Modo Assistente** (ver `assistant-mode.md`):
  1. Grade de Ações Rápidas (contextual, filtrada por permissão).
  2. Chips de Sugestões Contextuais (até 3).
  3. Histórico recente colapsável (últimas 3 interações).
- Composer minimizado no rodapé: placeholder `Pedir algo...`; expande ao focar.

## Estados visuais
| Estado | Aparência |
|---|---|
| Oculto | Sem botão (rotas públicas e de impressão) |
| Idle | Botão flutuante discreto |
| Sugestão proativa | Badge numérico no botão + tooltip "N sugestões" |
| Executando Action | Card inline no painel: ícone + ação humana + spinner |
| Aguardando confirmação | Card com resumo + botões Confirmar/Cancelar |
| Streaming texto | Indicador de tokens no header |
| Erro | Toast com mensagem do gateway (429/402/etc.) |

## Mobile
- Botão move para `bottom-20 right-4` (acima da bottom bar quando existir).
- Painel vira fullscreen.
- Sem atalho de teclado; gesto: swipe-up no botão abre.

## Onde NÃO aparece
- Landing pública (`/`).
- Login (`/login`, `/super-admin`).
- Inscrição (`/inscricao`).
- Telas de impressão (`/laudo/print/*`, `/imprimir/*`).
- Páginas com `data-ai-shell="off"` no container raiz.

## Tema
- Usa apenas tokens semânticos do `index.css`. Respeita dark mode automaticamente.

## Notificações proativas
- Context Engine emite hints leves (ver `proactive-suggestions.md`); badge incrementa.
- Máximo 3 hints visíveis; nunca toast, nunca modal, nunca som.

## Anti-padrões proibidos
- Chamar de "Chat", "Bot", "IA", "Copilot" em qualquer texto visível.
- Abrir o painel já no input de mensagem (sempre abre em Modo Assistente).
- Mensagem de boas-vindas conversacional ("Olá, como posso ajudar?").
- Criar rota `/agent` ou `/ai`.
- Usar `useNavigate()` para mover o usuário sem confirmação.
- Abrir modal por cima de modal.
- Reproduzir áudio sem ação explícita.
- Persistir estado de UI no localStorage entre tenants.
- Ícones decorativos sem ação associada.
