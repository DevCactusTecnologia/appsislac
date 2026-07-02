# 02 — Process Necessity

Base: fluxos F1–F10 e sequências S1–S11 da Fase 03.

| Processo | Classe | Justificativa |
|---|---|---|
| F1 Atendimento presencial | Obrigatório | Núcleo operacional; não existe laboratório sem ele |
| F2 Coleta | Configurável | `tenant_lab_config.registrar_coleta`; alguns labs recebem amostras externas |
| F3 Análise & Resultado | Obrigatório | Sem análise não há laudo |
| F4 Assinatura & liberação | Obrigatório (regulatório) | RDC 302 exige RT identificado |
| F5 Entrega ao paciente | Obrigatório | LGPD + boas práticas; canal varia |
| F6 Financeiro (caixa) | Administrativo | Necessário quando há atendimento particular |
| F7 Faturamento convênio | Comercial | Só relevante para labs com convênios |
| F8 Integração lab apoio | Operacional condicional | Só para exames terceirizados |
| F9 Migração Shared→Dedicated | Infraestrutura (produto SaaS) | Não é domínio de laboratório |
| F10 Site público / leads | Comercial | Aquisição, não operacional |
| S3 Recoleta | Obrigatório laboratorial | Erro de coleta é evento clínico real |
| S5 Resultado crítico | Obrigatório regulatório | Comunicação de valores críticos é norma |
| S6 Orçamento | Comercial | Não é operação clínica |
| S8 Cancelamento com motivo | Obrigatório auditoria | Rastreabilidade RDC |
| S9 Edição pós-liberação | Obrigatório auditoria | Retificação com justificativa |
| S10 Migração de tenant | Infraestrutura | Ferramenta interna SISLAC |
| S11 IA com approval | Produto | Escolha SISLAC (não é domínio) |

**Padrão observado:** todo processo classificado como obrigatório tem base regulatória (RDC 302 / LGPD) ou clínica; os "configuráveis" são explicitamente gated por `tenant_lab_config` — indicando que a variabilidade já é reconhecida no código.
