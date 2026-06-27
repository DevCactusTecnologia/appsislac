# 02 — Arquitetura

## Diagrama atual (texto)

```text
[Usuário]
   │ click / fala / digita
   ▼
[AssistenteSISLAC.tsx]  (único componente)
   ├── parseLocalIntent ──► useNavigate (atalho local sem LLM)
   ├── streamAiChat ─────► POST /functions/v1/ai-chat (SSE)
   ├── MediaRecorder ────► POST /functions/v1/ai-transcribe
   └── ai-speak invoke ──► POST /functions/v1/ai-speak

   ── órfãos do frontend ──
   src/lib/ai/contextEngine.ts   (useAIContext)         ← ninguém importa
   src/lib/ai/manifestClient.ts  (useManifest)          ← ninguém importa
                                                       │
                                                       ▼
                                            /functions/v1/ai-manifest  ← sem consumidor

[ai-chat]
   ├── _shared/aiAuth ──► auth.getUser + RPC current_tenant_id
   ├── _shared/registry (CAPABILITIES[]) ──► resolveAllowedCapabilities (has_permission RPC)
   ├── skills/paciente, skills/atendimento, skills/resultado
   ├── streamText (Gemini 2.5 Flash) — stepCountIs(5)
   └── onFinish → INSERT ai_audit
```

## Quem chama quem

| Origem | Destino |
|---|---|
| `App.tsx` | `AssistenteSISLAC` |
| `AssistenteSISLAC` | `supabase.auth.getSession`, `ai-chat`, `ai-transcribe`, `ai-speak`, `useNavigate` |
| `ai-chat` | `aiAuth.authenticate`, `aiAuth.resolveAllowedCapabilities`, `skills/*`, Lovable Gateway, `ai_audit` |
| `ai-manifest` | `aiAuth.*`, `buildManifest()` |
| `ai-speak` / `ai-transcribe` | `aiAuth.authenticate`, Lovable Gateway |
| `skills/*` | `userClient` (Supabase com JWT do usuário, RLS aplicada) |

## Componentes paralelos / duplicação

1. **Duas trilhas de "descoberta de Capabilities"**
   - Servidor: `resolveAllowedCapabilities` em `ai-chat` (usada de fato).
   - Cliente: `useManifest` + `discoverCapabilities` + `ai-manifest` (nunca usados em UI).
   - **Duplicação ativa**: o `buildManifest` espelha o `CAPABILITIES`, mas o cliente que o consumiria não existe.

2. **Dois caminhos de execução**
   - `parseLocalIntent` (regex hardcoded de navegação no frontend).
   - `system prompt` no `ai-chat` que orienta o LLM a chamar tools (servidor).
   - Sobreposição: comandos "abrir atendimentos", "ir para pacientes" são tratados duas vezes.

3. **Memória/threads zumbis**
   - `ai_threads` e `ai_messages` modeladas no banco mas o frontend não envia `threadId`, não lê histórico, não persiste mensagem. A conversa vive apenas no `useState` local (`chatMessages.slice(-30)`).
   - O `ai-chat/index.ts:30` aceita `threadId`, grava-o em `ai_audit`, mas ninguém manda.

4. **Knowledge base inerte**
   - `docs/assistant-knowledge/*.md` não é lido por ninguém (sem RAG, sem fetch, sem embed).

## Acoplamentos / dependências circulares

- **Nenhuma circular**.
- Acoplamento saudável: `aiAuth` ↔ `registry` (servidor) — SSOT.
- Acoplamento morto: cliente ↔ `ai-manifest`.
- Acoplamento implícito: `parseLocalIntent` precisa repetir rotas que já existem no React Router e em `contextEngine.ts:moduleFromPath` (terceira fonte de verdade sobre rotas).

## Conclusão arquitetural

A arquitetura **prometida** (Capability Registry → Manifest → Discovery → Quick Actions → Skills → Audit + Memory) está apenas **metade construída**. O caminho operacional real é muito mais simples:

```text
Usuário → AssistenteSISLAC → ai-chat (Gemini + tools) → resposta
```

Tudo o que envolve Manifest/Discovery/Memory/Knowledge é **esqueleto sem músculo**.
