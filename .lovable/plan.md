# AI-SISLAC 2.0 — Core Consolidation

Intervenção estrutural única e final. Reduz o Assistente ao caminho operacional oficial:

```text
Usuário → Texto/Voz → AssistenteSISLAC.tsx → ai-chat → Skills → Tools → Serviços → Banco → Resposta
```

Tudo fora desse caminho será removido por completo (sem comentários, sem deprecation, sem legado).

## Escopo de remoção (consumidor zero confirmado antes de apagar)

**Frontend**
- `src/lib/ai/manifestClient.ts`, `src/lib/ai/contextEngine.ts`, `src/lib/ai/capabilityRegistry.ts` (espelho)
- Quick Actions, Discovery, Suggestions, Memory não usada
- Componentes/hook órfãos do antigo `AiShell` (após confirmar que `AssistenteSISLAC.tsx` é o único montado)

**Backend (Edge Functions)**
- `supabase/functions/ai-manifest/` (deleta deploy)
- `supabase/functions/_shared/registry.ts` reduzido ao mínimo (`id`, `description`, `permission`, `category`, `needsApproval`, `tool`)
- `supabase/functions/_shared/aiAuth.ts` mantém apenas `authenticate`, `jsonResponse`, `aiCorsHeaders`, `resolveAllowedCapabilities`

**Banco (migração destrutiva)**
- DROP `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` (policies, índices, triggers, types)
- **Mantém `ai_audit`** — único registro de execução exigido pela Etapa 9

**Skills**
- Funde `resultado.set_valor` + `resultado.set_varios` em uma única tool `resultado_set` (aceita 1..N parâmetros)

**Prompts**
- `ai-chat` passa a montar dois system prompts mínimos: `PROMPT_TEXT` e `PROMPT_VOICE`, escolhidos por `context.mode`
- Remove qualquer referência a Manifest/Discovery/Quick Actions/ElevenAgent

**Documentação**
- Remove `docs/intelligence-platform/` inteiro
- Remove `docs/ai-agent-1.0/`, `docs/ai-agent-rollback/`, `AI-SISLAC/` (radiografia antiga)
- Avalia `docs/assistant-knowledge/`: se não for carregada em runtime, **remove**; o `ai-chat` atual não a injeta, então será removida
- Consolida tudo em `docs/AI-SISLAC/` com 7 documentos finais:
  - `Architecture.md`, `Capabilities.md`, `Voice.md`, `Security.md`, `Developer.md`, `UserGuide.md`
  - + relatórios: `core-consolidation.md`, `cleanup-report.md`, `architecture-final.md`, `performance-final.md`, `security-final.md`, `operational-validation.md`, `executive-report.md`

## Segurança (Etapa 10)
- `needsApproval` deixa de ser apenas hint do prompt. O `ai-chat` retorna `requires_approval` para tools marcadas; o `AssistenteSISLAC.tsx` exibe diálogo de confirmação **na interface** antes de re-emitir a chamada com `_confirmed: true`.

## Performance (Etapa 11)
- `authenticate()` resolve JWT + tenant + permissões em **uma** chamada e cacheia no escopo da request
- Remove RPCs redundantes em `resolveAllowedCapabilities`

## Auditoria (Etapa 9)
- `ai_audit` registra por execução: `tool`, `capability`, `user_id`, `tenant_id`, `duration_ms`, `status`, `error_code`, `result_summary`
- Remove auditoria genérica de "router"

## O que NÃO muda
- `AssistenteSISLAC.tsx` (UI já em produção)
- Pipeline de voz ElevenLabs (mesma tool chain do texto)
- Capabilities operacionais: `paciente.search`, `paciente.create`, `paciente.exames`, `atendimento.*`, `resultado.open`, `resultado.set`
- Tabela `ai_audit`

## Critério de sucesso (resposta final)
Relatório executivo com contagem exata de: arquivos removidos, LoC removidas, tabelas eliminadas, edge functions eliminadas, documentos consolidados, componentes remanescentes, e validação de que texto+voz usam o mesmo pipeline.

## Riscos a confirmar antes de executar
1. **DROP de 4 tabelas é destrutivo e irreversível.** Confirmo: nenhum dado em produção, apenas estrutura órfã? (a radiografia AI-SISLAC indicou consumidor zero)
2. **Remoção de `docs/intelligence-platform/` (~80 arquivos) e `AI-SISLAC/` (radiografia)** — confirmo consolidação total em `docs/AI-SISLAC/`?
3. **Remoção de `docs/assistant-knowledge/`** caso não seja injetada no prompt do `ai-chat` (confirmação por leitura do código antes de apagar)?

Aprovando, executo as 13 etapas em sequência e entrego o relatório final com "Assistente SISLAC 2.0 — Core Consolidado."
