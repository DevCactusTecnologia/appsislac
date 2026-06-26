# Performance Model

## Metas
- TTFB do streaming: **< 1.2s** p50.
- Custo médio por mensagem: **< US$ 0.003** (Gemini Flash).
- Latência de Tool read: **< 400ms** p95.
- Zero chamada redundante ao LLM por contexto não mudado.

## Estratégias

### 1. Modelo padrão
- `google/gemini-3-flash-preview` para chat e tool routing.
- Modelos maiores (Pro) só sob demanda explícita ou Skills específicas (a definir).

### 2. Streaming sempre
- `streamText` + `toUIMessageStreamResponse`.
- AI Shell renderiza tokens conforme chegam.
- `withLovableAiGatewayRunIdHeader` para correlacionar logs.

### 3. Cache
| O que | Onde | TTL |
|---|---|---|
| Catálogo de Skills permitidas por usuário | Memória do Edge (per warm instance) | 5 min |
| Lookup `has_permission` | Memória do Edge | 60s |
| `current_tenant_id()` resolvido | Memória do Edge | requisição |
| Envelope de contexto compactado | Browser | até route change |
| Threads/mensagens recentes | react-query (`["tenant", tid, "ai", ...]`) | invalidate em mutate |

### 4. Controle de tokens
- System prompt **enxuto** (<800 tokens base) + fragmentos só das Skills permitidas.
- Histórico enviado: últimas **20 mensagens** OU **6.000 tokens**, o que vier primeiro. Sumarização opcional acima disso (fase 2).
- Tool outputs truncados (≤ 8 KB) antes de voltar ao LLM.

### 5. Rate limiting
- Por usuário: 60 msg/h (configurável).
- Por tenant: 2.000 msg/dia (por plano).
- Implementado via tabela `ai_rate_limit` + check no início do Edge.

### 6. Tool deferral
- Se Skills permitidas expõem >40 tools, usar padrão `ai-sdk-tool-deferral` (tool meta de busca/invocação).

### 7. Reutilização de contexto
- Mesma thread mantém envelope estável; só re-anexa se algo mudou (route, focus).
- Envelope diff-based no payload (delta opcional, fase 2).

### 8. Anti-loops
- `stopWhen: stepCountIs(50)`.
- Detecção de tool call repetida idêntica → erro `LOOP_DETECTED` ao LLM.

### 9. Edge cold start
- Edge mantém imports mínimos no topo; Skills lazy-loaded por permissão.
- Pacote final < 2 MB.

## Observabilidade
- Logs do gateway via `X-Lovable-AIG-Run-ID` (correlação).
- Métricas: latência por Skill, taxa de aprovação, erros por código.
- Dashboard de IA na área Super Admin (fase 2).

## Custo
- Estimar por tenant via `ai_audit.duration_ms` + contagem.
- Cota suave: alerta em 80% do plano; bloqueio em 100%.
