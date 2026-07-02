# 08 — Functional Dependencies

Impacto funcional se cada módulo desaparecesse (não é proposta de remoção — apenas medição).

| Se removido | Processos que deixariam de existir |
|---|---|
| Paciente | Todo o restante — nada opera sem sujeito |
| Atendimento | Financeiro, Coleta, Análise, Laudo, Faturamento, WhatsApp, Produção, Auditoria clínica |
| Coleta | Rastreio físico da amostra; análise perde origem determinística |
| Análise | Resultado, Laudo, Entrega, Faturamento (não há o que cobrar) |
| Resultado / Laudo | Entrega, WhatsApp de resultado, Faturamento |
| Assinatura | Liberação regulatória do laudo (bloqueia toda entrega) |
| Financeiro | Caixa, PIX, recibo, faturamento |
| Convênios | Cobrança de convênio, glosas, competências |
| Estoque | Controle de insumo (não bloqueia clínica) |
| Soroteca | Guarda pós-análise e expurgo (não bloqueia liberação) |
| Integrações lab apoio | Exames terceirizados param; internos seguem |
| WhatsApp | Notificações automáticas param; portal e email seguem |
| Auditoria | Rastreabilidade regulatória — quebra RDC/LGPD |
| Super Admin | Provisionamento de tenants e migração |
| Migração | Movimentação Shared→Dedicated |
| IA | Assistente conversacional; operação segue |
| LGPD | Compliance regulatório |
| Landing / TenantSite | Aquisição e site público |
| Cadastro público | Auto-cadastro via site; balcão segue |

**Cadeia crítica (single points of dependency):** Paciente → Atendimento → Análise → Resultado → Assinatura → Entrega. Tudo mais gira em torno dessa espinha.
