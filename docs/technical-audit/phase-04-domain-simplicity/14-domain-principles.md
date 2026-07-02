# 14 — Domain Principles

Princípios inferidos exclusivamente a partir das evidências acumuladas nas Fases 01–03.

| Princípio | Evidência |
|---|---|
| **Rastreabilidade** | `*_audit` em quase toda tabela; triggers; `atendimento_audit.justificativa`; auditoria dupla analisado≠liberado |
| **Auditabilidade regulatória** | RDC 302 (RT/CNES), LGPD (consent/deleção/relatório), CNPJ obrigatório em recibo |
| **Isolamento (multi-tenant)** | `tenant_id NOT NULL`, RLS com 4 policies, `current_tenant_id()` server-side, jamais confiar no frontend |
| **Segurança por defesa em profundidade** | Permissão validada na UI, na edge function e no DB; super admin revalidado em cada função |
| **Configurabilidade por laboratório** | `tenant_lab_config`, `notification_policy`, layouts, templates, providers |
| **Determinismo e idempotência** | Idempotency-key em atendimento, protocolo sequencial, FNV-1a no comprovante, jobs idempotentes |
| **Resiliência de integração** | Outbox WhatsApp, circuit breaker, dead-letter, retry por provider |
| **Automação com humano no controle** | IA com `needsApproval`, WhatsApp `automatic|manual` por tipo |
| **Preservação de estado clínico** | `update_atendimento_tx` preserva IDs/estados; layout de impressão travado |
| **Progressividade da plataforma** | Migração Shared→Dedicated sem perda de senhas; `runtime_mode` explícito |
| **Simplicidade da experiência** | Ctrl+K global, fluxos configuráveis via toggle único, entradas financeiras read-only |
| **Compliance financeiro** | Estorno com justificativa, entradas derivadas de atendimento (não editáveis) |

Nenhum princípio contraditório encontrado; a codebase é internamente coerente com esses princípios.
