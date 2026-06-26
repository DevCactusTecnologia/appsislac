# Phase 2 — Context Engine

`src/lib/ai/contextEngine.ts` — hook `useAIContext()` único.

Resolve automaticamente:
- `route.path` e `route.params` via `useLocation`/`useParams`;
- `module` via prefixo do path (pacientes, atendimentos, exames, resultados, soroteca, financeiro, produção, dashboard, configurações);
- `focus.pacienteId|atendimentoId|exameId|resultadoId|amostraId` via param `:id` mapeado pelo módulo.

Tenant e usuário NÃO entram no envelope — o Edge resolve via `current_tenant_id()`.
Sem PII no contexto (sem nomes, CPF, valores). Apenas IDs.

`getContextualSuggestions(ctx)` devolve no máximo 3 chips. Em Fase 2 implementa-se apenas o gancho com 1 exemplo (histórico do paciente em foco).
