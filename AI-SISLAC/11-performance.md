# 11 — Performance

## Round-trips por turno (modo texto, sem ferramenta)

| Operação | Quantidade |
|---|---|
| `supabase.auth.getSession()` (cliente) | 1 |
| `POST /functions/v1/ai-chat` | 1 |
| Dentro de `ai-chat`: `auth.getUser` | 1 |
| RPC `current_tenant_id` | 1 |
| RPC `has_permission` × N Capabilities | **8** |
| LLM (Gemini 2.5 Flash) streaming | 1 |
| INSERT `ai_audit` | 1 |
| **Total DB hits** | **11** |

## Round-trips por turno (modo voz, sem ferramenta)

`/ai-transcribe` (auth+STT) + `/ai-chat` (auth+perms+LLM+audit) + `/ai-speak` (auth+TTS) =
`auth.getUser × 3` + `current_tenant_id × 3` + `has_permission × 8` (só no chat) + 3 chamadas Gateway = **~17 round-trips**.

## Gargalos identificados

1. **N RPCs `has_permission`** por turno (linha `aiAuth.ts:resolveAllowedCapabilities`) — deveria ser **1 RPC** retornando o conjunto de permissões, ou cache em memória por usuário.
2. **`auth.getUser` repetido** nas 3 edge functions de voz/chat — sem cache.
3. **Sem cache do Manifest** (no servidor; o cliente tem mas não usa).
4. **TTS espera resposta completa** do LLM em vez de iniciar com primeiros tokens.

## Custo estimado por turno
- LLM Gemini 2.5 Flash: ~0.5-1 K tokens entrada + 0.2 K saída ≈ $0.0002.
- STT: ~$0.006/min.
- TTS: ~$0.015/1 K chars.
- Turno texto: praticamente desprezível (~$0.0003).
- Turno voz 10s entrada + 5s saída: ~$0.002.

## Capacidade
- Edge Functions Supabase: limite padrão. Não há rate limit interno por usuário.
- Risco: usuário com microfone aberto poderia disparar STT em loop. Não há proteção.
