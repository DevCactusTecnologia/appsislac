# 11 — Domain Coupling

## Acoplamentos naturais (pertencem ao domínio)

| A ↔ B | Motivo |
|---|---|
| Atendimento ↔ Paciente | Sujeito da operação |
| Atendimento ↔ Convênio/Preço | Precificação obrigatória |
| Atendimento ↔ Financeiro (entrada) | Todo atendimento gera contas |
| Coleta ↔ Amostra ↔ Análise | Cadeia física da amostra |
| Análise ↔ VR / Régua etária | Validação clínica |
| Resultado ↔ Auditoria dupla | Regulatório |
| Laudo ↔ Assinatura RT | RDC 302 |
| Entrega ↔ LGPD/Consentimento | Regulatório |
| Faturamento ↔ Convênio ↔ Glosa | Financeiro-comercial |

## Acoplamentos por implementação (não pelo domínio)

| Acoplamento | Evidência |
|---|---|
| Todo store ↔ `runtime/db.ts` singleton | Fachada única de acesso; não é regra de negócio |
| Toda edge function ↔ `_shared/runtime/db.ts` | Padrão técnico |
| Toda tabela de domínio ↔ `current_tenant_id()` + 4 policies | Convenção multi-tenant |
| Frontend ↔ `AuthContext` para tenant | Decisão de arquitetura |
| Realtime ↔ canais filtrados por tenant | Escolha de transporte |
| WhatsApp ↔ Outbox ↔ Dispatcher ↔ Meta | Padrão reliability |
| Integrações ↔ Circuit breaker ↔ Dead-letter | Padrão resiliência |
| Migração ↔ 7 fases + `tenant_migration_runs` | Orquestração técnica |
| UI Sidebar ↔ `tenant_lab_config` (redirecionamentos) | Regra de UX derivada de config |

Acoplamentos técnicos são consistentes (mesmo padrão repetido), o que os torna previsíveis; acoplamentos de domínio seguem a cadeia clínica clássica.
