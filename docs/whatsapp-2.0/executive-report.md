# WhatsApp 2.0 — Fase 1.8 — Relatório Executivo

> Radiografia completa do WhatsApp do SISLAC para embasar a migração ao modelo Meta centralizado.
> Esta fase é **apenas diagnóstica**. Nada foi alterado em código, banco, templates ou webhooks.

---

## 1. Como funciona o WhatsApp hoje?

Cada laboratório configura individualmente um dos 3 modos em `Configurações → Notificações`:

- **`simples`** — abre `wa.me` no browser; recepcionista clica "Send". Sem log, sem custo Meta, sem template.
- **`cloud_api`** — credenciais Meta próprias (`phone_number_id`, `access_token`) por tenant. Edge `whatsapp-send` posta em `graph.facebook.com/v21.0/...`. Sem templates cadastrados — só funciona em sandbox/24h.
- **`zapi`** — credenciais Z-API (provedor não-oficial). Mesma edge function, branch separado.

**Disparos hoje são todos manuais**:

1. Comprovante (atendimento/pagamento) — botão em `PdfPreviewDialog`.
2. Orçamento — botão em `Orcamentos.tsx` / `NovoAtendimento.tsx`.
3. Botões "Falar com paciente/especialista" — apenas abrem `wa.me` vazio.
4. OTP de inscrição (lead público) — único disparo automático, via `leads-manager` com credenciais Meta **globais** em `app_settings.whatsapp_config`.

Webhook `/whatsapp-webhook` recebe status (sent/delivered/read/failed) da Meta, valida HMAC com `WHATSAPP_APP_SECRET` e atualiza `whatsapp_mensagens.status`.

---

## 2. Quantos provedores existem?

**3 provedores/modos**: Meta Cloud API, Z-API, wa.me (WhatsApp Web).

---

## 3. Quantos pontos de configuração existem?

- **Por tenant**: `tenant_whatsapp_config` (1 linha × N tenants) — UI em `WhatsappCloudConfig.tsx` (491 LOC).
- **Global**: `app_settings.whatsapp_config` (Super Admin, JSONB) — usado só para OTP de inscrição.
- **Env**: `WHATSAPP_APP_SECRET` (HMAC do webhook).

Total: **3 pontos de configuração**.

---

## 4. Existe dependência por laboratório?

**Sim, completa.** Cada lab precisa:

- Criar conta Meta Business + número aprovado.
- Gerar `access_token` + `phone_number_id` + `waba_id`.
- Configurar webhook na Meta apontando para nosso endpoint com `webhook_verify_token` próprio.
- Marcar `ativo=true`.

Esse é o maior gargalo operacional do modelo atual.

---

## 5. Existe fila?

**Não.** Envios são síncronos na request do usuário. Sem `pg_cron`, sem worker, sem retry automático.

---

## 6. Existe auditoria?

**Parcial.** `whatsapp_mensagens` registra envios via Cloud API/Z-API com `enviado_por`, `status`, `payload`, `idempotency_key`. **Não** registra modo `simples`, nem botões `wa.me` hardcoded, nem OTPs.

---

## 7. Existe retry?

**Não.** Falha → status `failed` e retorna 502. Reenvio é manual.

---

## 8. Existe legado?

Não há código morto crítico, mas há **complexidade evitável**:

- 3 modos coexistindo
- 2 caminhos paralelos para Meta (tenant + global)
- 5 botões `wa.me` hardcoded fora da fachada
- Z-API (não-oficial, supérflua após centralização)

Detalhes em `complexity-report.md`.

---

## 9. O modelo Meta centralizado é viável?

**Sim, sem bloqueios técnicos.** Pré-requisitos já existem:

- ✅ Edge function `whatsapp-send` já abstrai provedor por modo — bastaria um modo `centralized`.
- ✅ `app_settings.whatsapp_config` já é o embrião do canal global.
- ✅ Webhook já está pronto para receber status (basta 1 `WHATSAPP_VERIFY_TOKEN` global).
- ✅ `idempotency_key` impede duplicidade entre tenants.
- ✅ RLS em `whatsapp_mensagens` continua válida (tenant_id derivado server-side).

Gaps a resolver:

- ❌ **Criar 8 templates** na conta Meta corporativa (UTILITY + AUTHENTICATION).
- ❌ **Variável `{{1}} = nome_laboratorio`** em todos os templates.
- ❌ **Fila com retry** (necessária para alto volume vindo de todos os labs em 1 número).
- ❌ **Opt-out por paciente** (LGPD com 1 número compartilhado).
- ❌ **Rate limit** por tenant.

---

## 10. Qual deve ser a arquitetura do WhatsApp 2.0?

```text
┌──────────────────────────────────────────────────────┐
│             1 Conta Meta Business SISLAC            │
│             1 phone_number_id corporativo           │
│             1 access_token (Vault)                  │
│             8 templates aprovados (UTILITY+AUTH)    │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│         Super Admin Panel — WhatsApp Center         │
│  - configura conta Meta única                       │
│  - cadastra/gerencia templates                      │
│  - dashboard de envios (todos os tenants)           │
│  - rotação de token, métricas, opt-out global       │
└────────────────────┬─────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Lab A (ativo) Lab B (ativo) Lab N (opt-out)
        │            │            │
        └────────────┼────────────┘
                     ▼
         Edge `whatsapp-dispatch` (nova)
         - resolve template + vars{{1}}=lab.nome
         - checa opt-out, rate limit, ativo
         - enfileira em whatsapp_outbox
                     │
                     ▼
         pg_cron + Edge worker
         - drena outbox
         - POST graph.facebook.com (1 conta)
         - registra whatsapp_mensagens(tenant_id, ...)
         - retry exponencial (3x)
                     │
                     ▼
         Webhook `/whatsapp-webhook` (1 token global)
         - update status (sent/delivered/read/failed)
         - botões interativos (confirmar/cancelar/remarcar)
```

### Pontos-chave da migração sem quebrar nada

1. **Adicionar `modo='centralized'`** em `tenant_whatsapp_config` — manter `simples`/`cloud_api`/`zapi` durante transição.
2. **Edge `whatsapp-send` ganha branch** para o modo novo, lendo credencial de `app_settings.whatsapp_corporate_config` (ou Vault).
3. **Templates criados** e mapeados em nova tabela `whatsapp_templates`.
4. **Migração por lote**: Super Admin flipa cada tenant de `cloud_api` para `centralized`. Lab pode reverter.
5. **Botões `wa.me` hardcoded** migram para fachada `enviarComprovantePorWhatsapp` quando viável; senão, permanecem como atalho para conversa manual.
6. **OTP do `leads-manager`** passa a usar o mesmo template `sislac_otp_inscricao` no canal corporativo.

---

## Critério de Sucesso — atendido

A radiografia permite responder objetivamente:

- Onde estão tokens, números e configurações → `multi-tenant-map.md`.
- Como cada notificação é disparada → `business-flows.md`.
- Que tabelas registram o quê → `database-map.md`.
- Que riscos existem → `security-map.md`.
- Que complexidade pode ser simplificada → `complexity-report.md`.
- Que templates precisam ser criados → `templates-map.md`.
- O que existe e onde → `inventory.md`.

**Conclusão**: a centralização é viável, incremental e não exige rewrite. A Fase 2 pode começar pela criação dos templates Meta e pelo modo `centralized` na edge function, mantendo retrocompatibilidade.

---

## Regra de parada respeitada

✅ Nada foi implementado.
✅ Edge Functions inalteradas.
✅ Banco inalterado.
✅ Templates inalterados.
✅ Webhooks inalterados.
