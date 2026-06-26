# Validation — Fase 2.1

## Build / Typecheck / Lint
Executados pelo pipeline da Lovable após cada edição. Esta fase compilou sem
novos erros TS introduzidos (validado pelo loop do agent — typecheck final OK
após remoção de `capabilityRegistry.ts` e migração de consumidores).

## Smoke tests sugeridos
1. **Manifest endpoint**: `GET /functions/v1/ai-manifest` com JWT válido → 200,
   payload com `version`, `generatedAt`, `items[]` ordenados por `priority`.
2. **Permissões**: usuário sem `cadastrar_paciente` recebe `enabled=false` para
   `paciente.create`.
3. **Quick Actions**: AiShell mostra apenas itens com `quickAction=true && enabled`.
4. **Sugestões**: em `/pacientes/:id`, sugestão "Pesquisar paciente" aparece
   (derivada do Manifest; nenhuma string hardcoded).
5. **Cache**: segunda abertura do painel não dispara novo fetch.
6. **Multi-tenant**: trocar tenant invalida cache (perm/tenantId mudam).
7. **Tool Calling**: `paciente_search` continua funcionando (Edge usa CAPABILITIES
   diretamente, mesma SSOT).

## Validação automática do Registry
- Campos obrigatórios: id, title, description, category, visibility, priority,
  baselineSeconds, baselineClicks, actions.
- IDs duplicados: erro no cold-start.
- `actions` vazio: erro no cold-start.

## Regressão
Nenhuma. Tool Calling, RLS, Audit, multi-tenant intactos.
