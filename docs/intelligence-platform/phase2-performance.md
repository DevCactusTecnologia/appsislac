# Phase 2 — Performance

- **Streaming**: resposta entregue como SSE via `toUIMessageStreamResponse`; UI aplica `text-delta` incremental.
- **Lazy Load**: `AiShell` montado via `React.lazy` no `App.tsx`; só carrega após autenticação.
- **Catálogo**: `CAPABILITIES` é uma constante in-memory no Edge — sem round-trip ao DB.
- **Rate Limit**: confiamos no rate limit do Lovable AI Gateway (429 propagado à UI). Sem limiter custom nesta fase para evitar otimização prematura.
- **Tokens**: prompt do sistema curto (≤1KB) + contexto JSON enxuto (sem PII). `maxSteps: 5` para conter loops de tool.
- **Auditoria**: insert único no `onFinish` (não bloqueante para o usuário).
