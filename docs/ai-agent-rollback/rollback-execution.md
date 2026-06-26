# Execução do Rollback — AI Agent 1.1

## OECV
1. **Olhou** — `rg` em `src/` e `supabase/` por `agent|chat-agent|anthropic|elevenlabs`. Mapeados todos os consumidores (lista em `removed-files.md`).
2. **Entendeu** — Confirmado:
   - 2 referências em `src/App.tsx` (lazy + Route).
   - Cluster auto-contido em `src/{pages,components,hooks,lib,types,__tests__}` + `supabase/functions/chat-agent` + 1 migration órfã + 1 script de deploy.
   - Nenhum outro módulo do SISLAC importava nada de `agent`.
3. **Configurou** — Removidos os arquivos e diretórios listados; editado `src/App.tsx` para remover o lazy import e a Route `/agent`.
4. **Validou** — `rg` final por `agent|chat-agent|anthropic|elevenlabs` retorna apenas falsos positivos (`user-agent`, `Reagente`, `reagente`). Build/typecheck do harness verde após as edições.

## Confirmações
- Nenhum consumidor inesperado encontrado.
- Nenhum barrel/index re-exportava módulos do agent.
- Histórico de migrations preservado (apenas o arquivo órfão de janeiro/2024, que jamais foi aplicado, foi removido — não há migration versionada subsequente que o referencie).
