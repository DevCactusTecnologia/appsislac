# WhatsApp / Z-API — Executive Report
> Audit date: 2025-07 | Read-only audit

## 1. How it really works

```
Tenant configura modo: simples | cloud_api | zapi  (tenant_whatsapp_config)
Disparo (comprovante/atendimento/pagamento):
  PdfPreviewDialog → comprovantes.renderToBlob → upload-pdf (Storage) →
  comprovante-shortlink (/p/:cod) →
  modo=simples: window.open(wa.me)
  modo=cloud_api: edge whatsapp-send → Meta Graph v21 → INSERT whatsapp_mensagens
  modo=zapi:     edge whatsapp-send → Z-API REST   → INSERT whatsapp_mensagens
Webhook entrante:
  whatsapp-webhook (HMAC-SHA256) → UPDATE whatsapp_mensagens.status
Orçamento: sempre wa.me (bypassa edge), sem log.
```

## 2. Riscos consolidados

| ID | Severidade | Evidência | Resumo |
|----|------------|-----------|--------|
| W1 | 🔴 P0 | `whatsapp-send/index.ts` sem idempotência | Clique duplo gera duas mensagens cobradas |
| W2 | 🟠 P1 | sem retry/fila | Falha de rede = perda permanente |
| W3 | 🟠 P1 | Z-API não tem webhook de entrega | `status` fica `sent` para sempre |
| W4 | 🟠 P1 | templates hardcoded em 3 arquivos | Sem SSOT por tenant |
| W5 | 🟡 P2 | `tenant_whatsapp_config` guarda credenciais em texto plano | Recomenda-se cifragem |
| W6 | 🟢 baixo | HMAC valida assinatura Meta | Webhook não-spoofável |

## 3. Veredito

- **Confiável:** 🟠 Médio — sem retry/idempotência, depende de cliques humanos sem rede problemática.
- **Auditável:** ✅ para cloud_api/zapi; ❌ para simples e orçamento (sem log).
- **Escalável:** 🟠 Síncrono — limita throughput em pico.

## 4. Classificação

**Production Ready — Needs Hardening (W1, W2, W3).**
