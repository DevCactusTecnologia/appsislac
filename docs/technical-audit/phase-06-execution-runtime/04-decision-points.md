# 04 — Decision Points

Cada decisão do sistema tem **um único responsável**.

| Decisão | Responsável único | Local |
|---|---|---|
| Status do atendimento | Derivado automaticamente | RPC `update_atendimento_tx` + derivação em `atendimentoNormalize.ts` |
| Preço do exame | `calc_preco_atendimento_exame` (RPC) | Banco — fallback CBHPM/TUSS/Própria |
| Permissão de ação | `has_permission(role, perm)` / `has_role()` | RPCs security-definer no banco |
| Tenant do usuário | `current_tenant_id()` (JWT/session) | Banco |
| Super admin | `is_super_admin()` | RPC security-definer + revalidação em edges |
| Mudança de estado (atendimento) | RPC `update_atendimento_tx` | Banco (transação) |
| Cancelamento | RPC `cancel_atendimento_tx` + `motivos_cancelamento` | Banco |
| Assinatura/liberação de resultado | RPC `sign_resultado_tx` (exige 2º usuário) | Banco |
| Reference range (VR) | `resolve_vr_por_paciente` (sexo+idade+régua) | Banco |
| Valores críticos | `resolve_critico` + `criticoChecker.ts` | Banco + frontend (dupla checagem) |
| Preço final da fatura convênio | `calc_total_fatura` | Banco |
| Saldo devedor | `calc_saldo_devedor` | Banco |
| Roteamento shared vs dedicated | `tenant_registry.runtime_mode` | Banco (consumido por edges) |
| Flip de runtime | Edge `super-admin-migration-flip` | Server (edge) |
| Retry / Circuit / DLQ de integração | `_shared/drivers/pipeline.ts` + `circuit.ts` + `dlq.ts` | Server (edge) |
| Envio a laboratório de apoio | Driver do provider registrado em `registerCapabilities` | Server (edge) |
| Entrega de resultado | `resultados_entregas` + edge `comprovante-resolve` | Banco + edge |
| Numeração (guia/protocolo/amostra) | `next_*` sequencers | Banco |
| Fluxos opcionais (coleta/análise) | `tenant_lab_config` (feature flags) | Banco + AppSidebar |
| Redirect `/rotina` | `tenant_lab_config.registrar_coleta` | Frontend (AppSidebar) |
