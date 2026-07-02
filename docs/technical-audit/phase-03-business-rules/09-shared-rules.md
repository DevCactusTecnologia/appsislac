# 09 — Shared Rules

Regras utilizadas por mais de um módulo (apenas documentação, sem julgar duplicidade).

| Regra | Módulos que usam |
|---|---|
| `current_tenant_id()` — resolução tenant | Todos stores, todas edges, todos triggers |
| `has_permission(user, capability)` | RBAC de edges, sidebar visibility, IA tools |
| `is_super_admin()` | Toda function `super-admin-*`, policies restritas |
| `atendimentoPolicy.requerConfirmacaoEdicao` | Atendimento, Financeiro (via atendimento), Resultado |
| `pricing.calculateExamPrice` | NovoAtendimento (4 pontos antes; consolidado), Orçamento |
| `notificationPolicy.getNotificationMode` | Resultados, Recoletas, Orçamentos, Atendimentos, Agendamentos |
| `validarLaboratorioParaComprovante` | Comprovante pagamento, atendimento, comparecimento, laudo |
| `codigoVerificacao` (FNV-1a) | Comprovantes, verificação `/verificar/:codigo` |
| `resolucao-de-referencia-clinica` (sexo+idade+regra) | Análise, Impressão laudo, Crítico checker |
| `runtime/db.ts` singleton | 100% do frontend (stores, hooks, pages) |
| `_shared/runtime/db.ts` | 100% edges que tocam DB |
| `tenant_lab_config.registrar_coleta / analisar_amostras` | Sidebar, RotinaGuard, NovoAtendimento (fluxo), Resultados |
| `set_audit_justificativa` (GUC) | Todo update sensível (atendimento, financeiro, config) |
| `ttlCache` | pacienteStore, atendimentoStore, notificationPolicy |
| `idempotency_key` | create-atendimento, integration-jobs |
| Padrão queryKey `["tenant", tenantId, ...]` | Todas queries React Query |
| `showError` | Frontend inteiro (tratamento uniforme) |
| Cabeçalho legal (CNES/RT/UF/CNPJ) | Todos documentos impressos |
| Layout impressão travado (constraint) | ResultadoDetalhe, ImpressaoGeral, comprovantes |
| Convênio "Particular" ID 0 | Atendimento, Orçamento, Financeiro |
