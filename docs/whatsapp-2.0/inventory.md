# WhatsApp 2.0 — Fase 1.1 — Inventário Técnico

Snapshot do que existe HOJE no SISLAC referente a WhatsApp.
Escopo: somente mapeamento. Nada é alterado, removido ou deprecado nesta fase.

---

## 1. Edge Functions

| Função | Caminho | Verify JWT | Responsabilidade |
|---|---|---|---|
| `whatsapp-send` | `supabase/functions/whatsapp-send/index.ts` | Sim (Bearer + `getClaims`) | Envia PDF/documento via Cloud API (Meta) **ou** Z-API, conforme `tenant_whatsapp_config.modo`. Idempotência por chave SHA-256 (tenant\|protocolo\|tipo\|telefone\|bucket5min). Registra em `whatsapp_mensagens`. |
| `whatsapp-webhook` | `supabase/functions/whatsapp-webhook/index.ts` | Não (público — chamado pela Meta) | Handshake `hub.verify_token` casando contra qualquer `tenant_whatsapp_config.webhook_verify_token`. POST atualiza `whatsapp_mensagens.status` (sent/delivered/read/failed) via HMAC `x-hub-signature-256` validado com `WHATSAPP_APP_SECRET` (fail-closed). |
| `leads-manager` | `supabase/functions/leads-manager/index.ts` | Não (público — formulário de inscrição) | Envia OTP de validação para o WhatsApp do lead em `app_settings.whatsapp_config` (global, provider=`meta`, `phoneNumberId` + `accessToken`). **Caminho independente do tenant_whatsapp_config.** |
| `comprovante-shortlink` | `supabase/functions/comprovante-shortlink/` | Sim | Cria shortlink usado na caption do envio WhatsApp (não envia mensagem, mas faz parte do pipeline). |
| `comprovante-resolve` | `supabase/functions/comprovante-resolve/` | Não (link público) | Resolve shortlink para PDF — destino dos links enviados via WhatsApp. |

---

## 2. Stores / Services (Frontend)

| Arquivo | Função |
|---|---|
| `src/domains/result/services/comprovantesWhatsapp.ts` | `enviarPdfWhatsappCloud()` → invoca edge `whatsapp-send`; `buildWaUrl()` → constrói `wa.me/55<num>?text=`. Idempotência in-memory (5s lock). |
| `src/domains/result/services/comprovantesUpload.ts` | `uploadPdfAndGetUrl()` + `criarShortlinkPdf()` — gera URL pública/short que vai na mensagem. |
| `src/lib/comprovantes.ts` (fachada) | `enviarComprovantePorWhatsapp()`, `enviarOrcamentoPorWhatsapp()` — orquestram render PDF → upload → shortlink → abre `wa.me` no browser. |
| `src/data/rastreabilidadeStore.ts` | Tipos `CriticoCanal` e `EntregaCanal` incluem `whatsapp` (registro do canal usado, não dispara envio). |

---

## 3. Hooks

Nenhum hook React dedicado a WhatsApp foi encontrado. As chamadas são feitas direto dos componentes/páginas via `supabase.functions.invoke("whatsapp-send")` ou `window.open(wa.me ...)`.

---

## 4. Componentes / Telas que disparam WhatsApp

| Componente | Tipo de envio | Observação |
|---|---|---|
| `src/components/PdfPreviewDialog.tsx` | `enviarPdfWhatsappCloud()` (modo cloud_api/zapi) **+** fallback `buildWaUrl()` (modo simples) | Único componente que invoca a edge `whatsapp-send`. |
| `src/pages/NovoAtendimento.tsx` | `enviarOrcamentoPorWhatsapp()` | Apenas `wa.me` (modo simples, abre WhatsApp Web). |
| `src/pages/Orcamentos.tsx` | `window.open("https://wa.me/<num>?text=...")` (2 ocorrências) + `PdfPreviewDialog` | Hardcoded `wa.me`. |
| `src/pages/Pacientes.tsx` | `window.open("https://wa.me/55<num>")` | Botão "Falar com paciente". |
| `src/pages/Especialistas.tsx` | `window.open("https://wa.me/55<num>")` | Botão "Falar com especialista". |
| `src/components/rastreabilidade/Registrar{Critico,Entrega,Orientacoes}Dialog.tsx` | Apenas seleção de canal `whatsapp` na auditoria; **não envia automaticamente**. |
| `src/components/configuracoes/WhatsappCloudConfig.tsx` | Painel de configuração por tenant (modo + credenciais). |
| `src/components/configuracoes/NotificacoesTab.tsx` | Wrapper de `WhatsappCloudConfig` na aba "Notificações". |
| `src/pages/superadmin/SuperAdminConfiguracoes.tsx` | Edita `app_settings.whatsapp_config` (global Meta para envio de OTP de inscrição). |
| `src/pages/superadmin/SuperAdminInscricoes.tsx` | Visualiza leads que receberam OTP via WhatsApp. |
| `src/pages/Inscricao.tsx`, `src/pages/Landing.tsx` | Formulário público — dispara `leads-manager` que envia OTP. |
| `src/lib/tenantSite/vitrineStore.ts`, `TenantSite.tsx`, `TenantSiteContato.tsx`, `LandingTemplate.tsx`, `VitrinePublicaPanel.tsx`, `IdentidadeVisualPanel.tsx` | Exibem número WhatsApp público do laboratório no site institucional — não enviam mensagens. |

---

## 5. Webhooks externos

- **Meta → SISLAC**: `https://<project>.functions.supabase.co/whatsapp-webhook`
  - Handshake: GET com `hub.verify_token` (casa contra `tenant_whatsapp_config.webhook_verify_token`).
  - Status: POST com HMAC `x-hub-signature-256` (validado com `WHATSAPP_APP_SECRET`).
- **Z-API**: nenhum webhook configurado no código (somente outbound).

---

## 6. Providers / Integrações externas

| Provider | Modo | Credenciais |
|---|---|---|
| **Meta Cloud API** (`graph.facebook.com/v21.0`) | `cloud_api` | `phone_number_id` + `access_token` (por tenant) **OU** `app_settings.whatsapp_config` (global, só para OTP). |
| **Z-API** (`api.z-api.io`) | `zapi` | `zapi_instance_id` + `zapi_token` + `zapi_client_token` (por tenant). |
| **wa.me** (WhatsApp Web) | `simples` | Apenas número, sem credenciais. Abre browser. |

---

## 7. Rotas

Sem rotas dedicadas a WhatsApp. Configuração via `/configuracoes` (aba Notificações) e `/super-admin/configuracoes`.

---

## 8. Tabelas do banco

| Tabela | Função |
|---|---|
| `tenant_whatsapp_config` (15 col) | Configuração POR TENANT (modo, credenciais Cloud API, credenciais Z-API, webhook_verify_token, numero_simples, ativo). RLS por tenant. |
| `whatsapp_mensagens` (13 col) | Log de cada envio (tenant_id, atendimento_protocolo, telefone, tipo_documento, message_id, status, erro, payload, enviado_por, idempotency_key). |
| `app_settings` (key=`whatsapp_config`) | Configuração GLOBAL usada **apenas** pelo `leads-manager` (OTP). |

Detalhe em `database-map.md`.

---

## 9. Documentos / Templates de mensagem

Não há tabela de templates. Mensagens são strings construídas em código:

| Origem | Localização |
|---|---|
| Comprovante (atendimento/pagamento) | `src/lib/comprovantes.ts` → `enviarComprovantePorWhatsapp()` |
| Orçamento (paciente) | `src/lib/comprovantes.ts` → `enviarOrcamentoPorWhatsapp()` |
| Resultados, Recoleta, Agendamento, Orçamento Clínica, Confirmação Consulta | **NÃO EXISTEM** — nem template, nem disparador automático. |

---

## 10. Resumo numérico

- **3 modos** de envio coexistindo: `simples` (wa.me), `cloud_api` (Meta), `zapi` (Z-API).
- **2 caminhos de credencial Meta**: por tenant (`tenant_whatsapp_config`) + global (`app_settings.whatsapp_config`).
- **1 edge function de envio** (`whatsapp-send`) + **1 webhook** (`whatsapp-webhook`) + **1 OTP** (`leads-manager`).
- **2 tabelas de WhatsApp** (`tenant_whatsapp_config`, `whatsapp_mensagens`) + **1 chave global** (`app_settings`).
- **2 tipos de mensagem** automatizados no código (Comprovante, Orçamento). **5 tipos previstos** pela visão 2.0 ainda não implementados.
- **5 pontos hardcoded** `wa.me/...` espalhados em páginas (sem passar pela fachada).
