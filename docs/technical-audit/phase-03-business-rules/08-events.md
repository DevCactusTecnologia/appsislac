# 08 — Events

Catalogação dos eventos de domínio.

## Ciclo de atendimento
- `atendimento.criado` — `create-atendimento` → grava auditoria + protocolo.
- `atendimento.editado` — `update-atendimento` (+ justificativa se sensível).
- `atendimento.cancelado` — motivo obrigatório.
- `atendimento.finalizado` — todos resultados liberados.

## Coleta & Análise
- `amostra.registrada`
- `amostra.coletada`
- `amostra.alocada`
- `exame.digitado`
- `exame.analisado` (analista+ts)
- `exame.liberado` (validador+ts)
- `recoleta.solicitada` / `recoleta.executada`

## Laudo
- `laudo.assinado` — `sign-resultado`
- `laudo.gerado_pdf` — Document Engine 3.0
- `laudo.impresso_lote` — `laudoBatchPdf`

## Entrega
- `resultado.entregue` (portal, WhatsApp, presencial)
- `whatsapp.enfileirado` → `whatsapp_outbox`
- `whatsapp.enviado` → dispatcher → Meta
- `whatsapp.recebido_webhook` → `whatsapp-webhook`

## Financeiro
- `pagamento.registrado`
- `pagamento.quitado` (UI oculta QRCode)
- `pagamento.estornado` (justificativa)
- `pix.qrcode_gerado`
- `pix.confirmado_webhook`
- `caixa.aberto` / `caixa.fechado`

## Convênios
- `fatura.aberta` / `fatura.fechada` / `fatura.enviada`
- `glosa.registrada`

## Integrações
- `integration.job.criado` / `.executando` / `.sucesso` / `.retentando` / `.dead`
- `integration.pdf.recebido`
- `circuit.aberto` / `circuit.fechado`

## Estoque / Soroteca
- `insumo.movimentado`
- `lote.vencendo` (alerta)
- `expurgo.executado`

## Super Admin / Migração
- `tenant.criado`
- `tenant.provisionado`
- `migration.fase.iniciada` / `.concluida` / `.falhou`
- `migration.flip` (`runtime_mode` altera)
- `migration.rollback`
- `migration.smoke_test`
- `tenant.plan.alterado`

## IA / LGPD
- `ai.tool.executada` → `ai_audit`
- `ai.approval.requerida`
- `lgpd.consentimento.registrado`
- `lgpd.paciente.deletado`

## Auditoria transversal
- Triggers gravam: `audit_logs`, `operational_audit`, `atendimento_audit`, `financeiro_audit`, `storage_audit`, `platform_audit`, `app_settings_audit`, `pdf_override_audit`, `protocolo_auditoria`, `subscription_changes_log`, `tenant_provision_audit`.
