# WhatsApp 2.0 — Fase 1.2 — Mapeamento de Fluxos

Quem dispara, quando, qual mensagem, qual template, qual edge function, qual tabela registra.

---

## Fluxo A — Comprovante de Atendimento / Pagamento

| Item | Valor |
|---|---|
| **Quem dispara** | Recepcionista, ao gerar comprovante em `PdfPreviewDialog` (Novo Atendimento, Financeiro, Resultados). |
| **Quando** | Manual (clique em "Enviar por WhatsApp"). |
| **Mensagem** | String construída em `src/lib/comprovantes.ts → enviarComprovantePorWhatsapp()`. Inclui tipo, protocolo, data, nome paciente, total e link curto (`shortlink`). |
| **Template Meta** | NENHUM (texto livre + documento PDF). |
| **Edge function** | `whatsapp-send` (modo `cloud_api`/`zapi`) **ou** `window.open(wa.me)` (modo `simples`). |
| **Tabela** | `whatsapp_mensagens` (insert com `status`, `message_id`, `idempotency_key`). |
| **Pipeline** | render PDF (`renderToBlob`) → `uploadPdfAndGetUrl` (bucket Storage) → `criarShortlinkPdf` → invoke `whatsapp-send` → status atualizado depois pelo `whatsapp-webhook`. |

---

## Fluxo B — Orçamento (paciente)

| Item | Valor |
|---|---|
| **Quem dispara** | Recepcionista em `Orcamentos.tsx` ou `NovoAtendimento.tsx`. |
| **Quando** | Manual. |
| **Mensagem** | `src/lib/comprovantes.ts → enviarOrcamentoPorWhatsapp()` — título, paciente, convênio, lista de exames, total, link PDF. |
| **Template Meta** | NENHUM. |
| **Edge function** | Hoje **somente** `wa.me` (`window.open`). Não passa por `whatsapp-send`. |
| **Tabela** | Nenhuma (não há registro de envio para orçamento). |

---

## Fluxo C — OTP de Inscrição (lead público)

| Item | Valor |
|---|---|
| **Quem dispara** | Visitante em `/inscricao` (Landing). |
| **Quando** | Submit do formulário público. |
| **Mensagem** | Texto fixo: `"Seu código de confirmação SISLAC é: <OTP>"`. |
| **Template Meta** | NENHUM (mensagem livre — exige sessão de 24h ou template aprovado; hoje só funciona em sandbox/conta de teste). |
| **Edge function** | `leads-manager` (action=`submit`/`resend`). |
| **Credencial** | `app_settings.whatsapp_config` (GLOBAL, provider=`meta`). |
| **Tabela** | `inscricoes` (campo `codigo_validacao`, `tentativas_codigo`). |

---

## Fluxo D — Botão "Falar com paciente/especialista"

| Item | Valor |
|---|---|
| **Quem dispara** | Usuário em `Pacientes.tsx` / `Especialistas.tsx`. |
| **Quando** | Clique no ícone WhatsApp. |
| **Mensagem** | Nenhuma (apenas abre conversa vazia). |
| **Edge function** | Nenhuma. `window.open("https://wa.me/55<num>")` hardcoded. |
| **Tabela** | Nenhuma. |

---

## Fluxo E — Webhook de status (Meta → SISLAC)

| Item | Valor |
|---|---|
| **Quem dispara** | Meta (após `sent`/`delivered`/`read`/`failed`). |
| **Edge function** | `whatsapp-webhook`. |
| **Validação** | HMAC `x-hub-signature-256` com `WHATSAPP_APP_SECRET` (fail-closed). |
| **Tabela** | UPDATE em `whatsapp_mensagens` por `message_id`. |

---

## Fluxos PREVISTOS na visão 2.0 (NÃO EXISTEM HOJE)

| Tipo | Status atual | Gap |
|---|---|---|
| 1. Comprovante de Atendimento | ✅ Parcial (manual, sem template Meta) | Falta template aprovado + disparo automático no save do atendimento. |
| 2. Comprovante de Agendamento | ❌ Não existe | Não há fluxo de agendamento separado de atendimento. |
| 3. Resultados Prontos | ❌ Não existe | Quando resultado vira `liberado`, nenhuma notificação dispara. |
| 4. Orçamento | ✅ Parcial (manual, só `wa.me`) | Não passa pelo Cloud API; sem template; sem log. |
| 5. Recoleta | ❌ Não existe | `recoletas` é registrada mas não notifica WhatsApp. |
| 6. Orçamento Clínica | ❌ Não existe | Fluxo de clínica não existe ainda. |
| 7. Confirmação Consulta Clínica | ❌ Não existe | Sem botões interativos (Meta `interactive.button`). |

---

## Disparadores automáticos (triggers/cron)

Nenhum trigger DB ou cron envia WhatsApp hoje. **Todos** os envios são manuais (botão na UI). O único disparador "automático" é o OTP do `leads-manager` ao submeter o formulário.
