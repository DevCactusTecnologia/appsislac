# 01 — Business Overview

Auditoria funcional (read-only) do domínio SISLAC — Laboratório de Análises Clínicas SaaS multi-tenant.

## Natureza do negócio
Sistema de gestão para laboratórios clínicos cobrindo o ciclo completo: captação do paciente → recepção/atendimento → coleta → análise → laudo → assinatura → entrega → financeiro → auditoria/rastreabilidade, com camadas transversais de convênios, estoque, soroteca, integrações com laboratórios de apoio, IA assistiva, WhatsApp, LGPD e governança de super-admin.

## Macroprocessos identificados (20)
1. **Cadastro de Paciente** (`Pacientes.tsx`, `pacienteStore.ts`, `useCompliance`).
2. **Recepção / Solicitações Públicas** (`SolicitacoesSite.tsx`, `TenantSite*`, `leads-manager`).
3. **Atendimento** (`NovoAtendimento/*`, `create-atendimento`, `update-atendimento`, `atendimentoStore/*`).
4. **Orçamento** (`Orcamentos.tsx`, `orcamentoStore.ts`).
5. **Coleta de Amostras** (`RegistrarColeta.tsx`, `amostras`, `amostra_sequence`).
6. **Triagem / Alocação de Amostras** (`amostra_alocacoes`, `SorotecaTriagem.tsx`).
7. **Análise Laboratorial** (`AnalisarAmostra.tsx`, `atendimento_exames`).
8. **Validação Técnica & Auditoria dupla** (`ResultadoDetalhe/*`, `atendimento_audit`).
9. **Assinatura Digital / Liberação de Laudo** (`sign-resultado`, `upload-assinatura`).
10. **Entrega de Resultado** (`ConsultarResultados.tsx`, `resultados_entregas`, `comprovante-*`).
11. **Financeiro (Entradas/Saídas/Caixa)** (`Financeiro/*`, `caixa_sessoes`, `financeiro_*`).
12. **Convênios / Faturamento / Glosas** (`Convenios.tsx`, `convenio_*`).
13. **Produção & Mapa de Trabalho** (`Producao.tsx`, `Mapa.tsx`, `mapas_trabalho`).
14. **Estoque de Insumos** (`Estoque.tsx`, `estoque_*`).
15. **Soroteca (armazenamento pós-análise)** (`Soroteca*.tsx`, `sorotecaStore.ts`, `expurgo_*`).
16. **Integrações com Laboratórios de Apoio** (`integration-*`, `provider-*`, `lab-apoio-*`).
17. **WhatsApp Notifications** (`whatsapp-*`, `tenant_notification_settings`).
18. **Auditoria & Rastreabilidade** (`Auditoria.tsx`, `audit_logs`, `operational_audit`, `platform_audit`).
19. **Super Admin / Migração Shared→Dedicated** (`superadmin/*`, `super-admin-migrate-*`, `tenant_registry`).
20. **IA Assistente / LGPD** (`ai-chat`, `ai-suggest-exames`, `lgpd-*`).

## Atores
- Paciente (site público, WhatsApp).
- Recepcionista / Atendente.
- Coletador / Enfermagem.
- Analista laboratorial.
- Responsável técnico / Assinante.
- Financeiro / Caixa.
- Admin do tenant.
- Super Admin de plataforma.
- Sistemas externos (labs de apoio, Meta WhatsApp API, PIX PSP, Gemini/AI Gateway).

## Isolamento
Multi-tenant com dois runtimes:
- **shared** — RLS por `current_tenant_id()` no DB compartilhado.
- **isolated_db** — banco dedicado por tenant, roteado por `runtime/db.ts` + `tenant_registry`.
