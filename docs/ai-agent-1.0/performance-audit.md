# AI Agent 1.0 — Auditoria de Performance

## Estado atual

A função `chat-agent` retorna 500 em toda chamada (sem `ANTHROPIC_API_KEY`, schema inexistente). Não há tráfego real para medir.

## Análise estática

- **Sem cache**: cada pergunta dispara 1 chamada ao LLM; nenhuma desduplicação ou memoização.
- **Sem streaming**: a função usa `messages.create` (não-streaming); a UI mostra "Processando..." e bloqueia.
- **Contexto não-reaproveitado**: histórico do chat fica só no estado do componente; cada `sendMessage` envia 1 prompt isolado — o modelo perde memória entre turnos.
- **Tokens**: prompt fixo (~500 chars) + schema embutido. Crescimento previsível, mas sem `max_tokens` dinâmico.
- **Rate-limit**: ausente (a função oficial `ai-suggest-exames` tem 20/5min — copiar esse padrão).
- **Sem batching/parallel tools**: arquitetura prevê SQL via texto, sem tool-calling estruturado.

## Oportunidades (registradas, não executadas)

| # | Item | Ganho estimado |
|---|---|---|
| 1 | Trocar Anthropic por Lovable AI Gateway + Gemini Flash | custo ↓, latência ↓ |
| 2 | Adotar tool-calling em vez de SQL textual | tokens ↓, segurança ↑ |
| 3 | Streaming via `toUIMessageStreamResponse` (AI SDK) | TTFB ↓ |
| 4 | Cache de "perguntas frequentes" (KPIs do dashboard) | LLM calls ↓ |
| 5 | Enviar contexto da tela atual em vez de texto livre | tokens ↓, UX ↑ |
