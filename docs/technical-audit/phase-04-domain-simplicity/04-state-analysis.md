# 04 — State Analysis

Por máquina de estado (Fase 03 · `05-state-machine.md`), sem propor redução.

| Máquina | Estados | Todos com função clara? | Estado técnico? | Existe por implementação? |
|---|---|---|---|---|
| Atendimento | 8 + Cancelado | Sim | Não | Não — reflete ciclo clínico |
| Atendimento_exames | 8 (incl. recoleta, terceirizado) | Sim | Não | Não |
| Amostras | 5 | Sim | Parcial (`alocada`) | `alocada` existe pela decisão de separar registro de uso |
| Pagamento | 4 | Sim | Não | Não |
| Resultado (dupla auditoria) | 5 | Sim | Não | Não — regulatório |
| Convênio fatura | 5 | Sim | Não | Não |
| Solicitação pública | 4 | Sim | Não | Não |
| Recoleta | 4 | Sim | Não | Não |
| Integration job | 5 (queued→dead) | Sim | Sim (`retrying`) | `retrying` é técnico, decorre do circuit breaker |
| Circuit breaker | 3 (closed/open/half_open) | Sim | Sim (todos) | Puramente técnico |
| Migration tenant | 7 fases + rollback | Sim | Sim | Existe pela arquitetura SaaS SISLAC, não pelo laboratório |
| Runtime mode | 3 (shared/dual/isolated_db) | Sim | Sim | Idem |
| Caixa sessão | 3 | Sim | Não | Não |
| Estoque lote | 4 | Sim | Não | Não |
| Soroteca lote | 4 | Sim | Não | Não |
| WhatsApp outbox | 6 | Sim | Sim (`sending`, `dead`) | Necessário para outbox reliable |
| Consentimento LGPD | 3 | Sim | Não | Não — regulatório |

**Padrão:** todos os estados de negócio (atendimento, resultado, amostra, financeiro, faturamento) refletem realidade operacional. Os estados classificados como técnicos concentram-se em três áreas: integrações (jobs/breaker), mensageria (outbox) e migração — coerente com padrões conhecidos (reliable messaging, resiliência, orquestração).
