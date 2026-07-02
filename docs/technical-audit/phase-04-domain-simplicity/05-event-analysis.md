# 05 — Event Analysis

Classificação de cada evento catalogado (Fase 03 · `08-events.md`).

Legenda: **DOM** domínio · **TEC** técnico · **AUD** auditoria · **INT** integração · **OPE** operacional · **INTR** interno.

| Evento | Classe |
|---|---|
| atendimento.criado | DOM + AUD |
| atendimento.editado | DOM + AUD |
| atendimento.cancelado | DOM + AUD |
| atendimento.finalizado | DOM |
| amostra.registrada / coletada / alocada | DOM |
| exame.digitado / analisado / liberado | DOM + AUD |
| recoleta.solicitada / executada | DOM |
| laudo.assinado | DOM + AUD |
| laudo.gerado_pdf | TEC |
| laudo.impresso_lote | OPE |
| resultado.entregue | DOM |
| whatsapp.enfileirado / enviado / recebido_webhook | INT |
| pagamento.registrado / quitado / estornado | DOM |
| pix.qrcode_gerado / confirmado_webhook | INT |
| caixa.aberto / fechado | OPE |
| fatura.aberta / fechada / enviada | DOM |
| glosa.registrada | DOM + AUD |
| integration.job.* | INT |
| integration.pdf.recebido | INT |
| circuit.aberto / fechado | TEC |
| insumo.movimentado | OPE |
| lote.vencendo | OPE |
| expurgo.executado | OPE + AUD |
| tenant.criado / provisionado | INTR (plataforma) |
| migration.fase.* / flip / rollback / smoke_test | INTR |
| tenant.plan.alterado | INTR |
| ai.tool.executada / approval.requerida | TEC + AUD |
| lgpd.consentimento.registrado / paciente.deletado | DOM + AUD (regulatório) |
| Triggers em `*_audit` | AUD |

**Padrão:** eventos DOM concentram-se em atendimento, amostra, exame, financeiro, faturamento e LGPD — exatamente o núcleo laboratorial. Eventos TEC/INTR ficam restritos a plataforma (migração, tenants), integrações e circuit breaker.
