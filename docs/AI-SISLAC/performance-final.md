# Performance Final — AI-SISLAC 2.0

## Otimizações aplicadas

1. **Permissões em paralelo** — `resolveAllowedCapabilities` agora usa `Promise.all` (antes era loop sequencial). Para 7 capabilities, latência cai de ~7×RPC para ~1×RPC.
2. **Frontend não chama mais `ai-manifest`** — abertura do Assistente deixou de fazer fetch HTTP adicional. -1 round-trip por sessão.
3. **System prompt enxuto** — `PROMPT_TEXT` e `PROMPT_VOICE` cabem em ~25 linhas cada (antes era um único prompt de ~70 linhas). Menos tokens por turno.
4. **Tool resultado fundida** — uma chamada cobre 1 ou N valores. Em ditados longos, isso economiza N-1 round-trips ao LLM.
5. **Auditoria não bloqueia stream** — `admin.from("ai_audit").insert(...)` em `onStepFinish` roda fora do caminho crítico de bytes.

## Custo computacional

- Cold start: 1 deploy a menos (ai-manifest removida).
- Tokens/turno: redução estimada de ~30% pelo prompt menor e ausência de regras duplicadas.
