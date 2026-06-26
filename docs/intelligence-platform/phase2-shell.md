# Phase 2 — AI Shell

`src/components/ai-shell/AiShell.tsx`, montado dentro de `AppLayout` (rotas autenticadas), após `<Routes>`.

- Avatar fixo `bottom-4 right-4`, `40x40`, ícone `Sparkles`, tema oficial (`bg-primary`).
- Atalho `Ctrl/Cmd + J` global.
- Painel `Sheet` lateral à direita, 420px desktop / fullscreen mobile.
- **Sempre abre em Modo Assistente**: grade 2 colunas de Ações Rápidas filtradas por permissão; chips de Sugestões Contextuais derivados do Context Engine; composer minimizado embaixo.
- Oculto em: `/`, `/login`, `/super-admin`, `/inscricao`, `/laudo/print/*`, `/imprimir/*`, `/verificar/*`, `/r/*`.
- Nunca chama de "IA", "Chat", "Bot" ou "Copilot". Aria-label e tooltip oficiais.
- Streaming consumido linha a linha do SSE do AI SDK (`text-delta`).
