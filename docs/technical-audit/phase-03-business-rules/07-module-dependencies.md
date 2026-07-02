# 07 — Module Dependencies

## Matriz (→ depende de)

| Módulo | Depende de |
|---|---|
| Atendimento | Paciente, Convênio, Unidade, Exames Catálogo, Tabela Preço, Caixa, Auditoria |
| Coleta | Atendimento, Amostras, Materiais |
| Análise | Coleta (se ativa), Exame Parâmetros, Régua Etária, Valores Referência |
| Resultado/Laudo | Análise, Assinatura, Layout, Document Engine |
| Assinatura | Resultado, Storage (uploads), Config Lab (RT) |
| Entrega | Resultado, WhatsApp, Comprovantes |
| Financeiro | Atendimento (entradas read-only), Caixa, Formas/Destinos |
| Convênios Faturamento | Atendimento, Tabela Preço, Glosas |
| Produção/Mapa | Atendimento, Análise, Setores |
| Estoque | Fornecedores, Insumos, Lotes |
| Soroteca | Amostras, Estrutura, Expurgo |
| Integrações | Atendimento (exame terceirizado), Provider registry, Circuit breaker |
| WhatsApp | Notification policy, Outbox, Dispatcher, Meta API |
| Auditoria | Todos módulos (triggers) |
| Super Admin | Tenants, Registry, Migração |
| Migração | Auth, Storage, DB, Registry |
| IA | Capabilities registry, Permissions, Audit |
| LGPD | Paciente, Auditoria |
| Landing/TenantSite | Tenant resolve, Leads |
| Cadastro Paciente | LGPD |

## Independentes / hubs de regra
- **Hubs (concentram regra):** `atendimentoStore/*`, `runtime/db.ts`, `atendimentoPolicy.ts`, `pricing.ts`, `notificationPolicy.ts`, `comprovantesValidation.ts`, `tenant_registry`, RPCs `create_atendimento_tx` / `update_atendimento_tx`.
- **Apenas consomem regra:** Dashboard, Producao, Mapa, Auditoria (leitura), Relatórios, LandingPageResponsive.
- **Independentes:** Estoque (isolado do fluxo clínico), Soroteca (pós-análise), Landing pública, LGPD tools.

## Acoplamentos fortes
- Atendimento ↔ Financeiro (entradas derivadas).
- Atendimento ↔ Auditoria (triggers).
- Coleta ↔ Amostras ↔ Análise (cadeia rígida quando config ligada).
- Runtime ↔ Todo consumidor de DB (via `db` singleton).
