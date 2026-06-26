# Dependências — AI Agent 1.1

## NPM
Auditoria do `package.json`:
- `@anthropic-ai/sdk`: **não estava instalado**.
- `elevenlabs` / SDK relacionado: **não estava instalado**.

Conclusão: **0 dependências removidas**. O AI Agent 1.0 nunca chegou a ter dependências reais instaladas — apenas o `deploy-agent.sh` orientava a instalação, mas o passo nunca foi executado no projeto Lovable.

## Secrets
Auditoria via `fetch_secrets`:
- `ANTHROPIC_API_KEY`: ausente.
- `VITE_ELEVENLABS_KEY`: ausente.

Conclusão: **0 secrets removidos**.

## Edge Functions deployadas
- `chat-agent`: tentativa de delete retornou erro (função não estava deployada). Arquivos-fonte removidos do repositório.
