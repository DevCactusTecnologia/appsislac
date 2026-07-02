# 01 — Domain Necessity

Critério: "Se o SISLAC fosse reescrito hoje, isso seria inevitável?"

Legenda: **INEVITÁVEL** (qualquer laboratório precisa) · **CONDICIONAL** (parte dos laboratórios) · **PRODUTO** (decisão SISLAC) · **INFRA** (implementação) · **HISTÓRICO** (evolução).

| Capacidade | Classe | Evidência (Fase 03) |
|---|---|---|
| Cadastro de paciente + LGPD | INEVITÁVEL | RDC 302 / LGPD; `useCompliance`, `lgpd-*` |
| Atendimento com protocolo único | INEVITÁVEL | `create_atendimento_tx` + `protocolo_sequence` |
| Precificação por convênio/tabela | INEVITÁVEL | `pricing.calculateExamPrice` |
| Coleta com rastreio de amostra | CONDICIONAL | `tenant_lab_config.registrar_coleta` |
| Análise/digitação de resultado | INEVITÁVEL | `AnalisarAmostra`, `exame_parametros` |
| Valores de referência dinâmicos (sexo/idade/jejum) | INEVITÁVEL | Boas práticas laboratoriais + `reguas_etarias` |
| Auditoria dupla (analisado ≠ liberado) | INEVITÁVEL | RDC + `atendimento_audit` |
| Assinatura RT + laudo PDF | INEVITÁVEL | RDC 302 (RT), Document Engine |
| Entrega WhatsApp/portal público | CONDICIONAL | `whatsapp_outbox`, `/consultar` |
| Financeiro (caixa + PIX) | CONDICIONAL | `PagamentoDialog`, `caixa_sessoes` |
| Faturamento convênio + glosas | CONDICIONAL | `convenio_faturas` |
| Estoque de insumos | CONDICIONAL | `estoqueStore` |
| Soroteca / expurgo | CONDICIONAL | `sorotecaStore` |
| Integração lab de apoio | CONDICIONAL | `integration_jobs`, circuit breaker |
| Multi-tenant + isolamento por RLS | PRODUTO | Decisão SaaS SISLAC |
| Super Admin + migração Shared→Dedicated | PRODUTO | `tenant_registry`, `runtime_mode` |
| Assistente IA (tools + approval) | PRODUTO | `ai-chat`, `ai_audit` |
| Site público do tenant | PRODUTO | `TenantSite` |
| Mapa/Produção com métricas | CONDICIONAL | Gestão operacional |
| Landing/Inscrição | PRODUTO | Aquisição comercial |

Nenhuma capacidade catalogada foi classificada como HISTÓRICO puro nesta parte; todos os macroprocessos têm justificativa de domínio, produto ou infraestrutura declarada em código.
