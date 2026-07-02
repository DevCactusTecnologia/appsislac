# 12 — External Dependencies

## Inventário

| Dependência | Uso | Criticidade | Impede escalar? |
|---|---|---|---|
| **Lovable Cloud (Postgres + Storage + Auth + Realtime + Edge)** | Backbone integral | CRÍTICA | Sim — SPOF de plataforma |
| **Lovable AI Gateway** | `ai-chat`, `ai-suggest-exames`, `ai-transcribe`, `ai-speak` | ALTA | Rate-limit externo desconhecido |
| **Gemini 2.0 Flash** (via AI Gateway) | Assistente IA, sugestão de exames | ALTA | Depende de cota do gateway |
| **WhatsApp Business API** | `whatsapp-webhook`, `whatsapp-dispatcher`, `whatsapp-template-sync` | ALTA | Rate-limit Meta; templates aprovados manualmente |
| **PIX (banco parceiro)** | `create-atendimento`, webhook | ALTA | Depende de PSP |
| **Hermes-Pardini** | provider driver | MÉDIA | Depende de SLA do laboratório |
| **DBSync** | provider driver | MÉDIA | idem |
| **Lab Apoio genérico** | `lab-apoio-*` | MÉDIA | idem |
| **Email (Supabase Auth transactional)** | Signup, reset, magic link, impersonation | MÉDIA | Delegado ao Cloud |
| **Paged.js** (CDN? bundle?) | Geração de PDF | BAIXA | Client-side |
| **Claude/Lovable dev tooling** | Build-time apenas | N/A | N/A |

## Impedem escalar (evidência)

- **Lovable Cloud plano atual**: 60 conexões DB, memória 67%. Escalar tenants exige upgrade de plano ou runtime dedicated.
- **WhatsApp**: rate-limit do provedor Meta é limite duro.
- **AI Gateway**: cota compartilhada.

## Achados

| # | Item | Severidade |
|---|---|---|
| D01 | SPOF único de plataforma (Lovable Cloud) | ALTO |
| D02 | Sem multi-provider fallback para AI | MÉDIO |
| D03 | Sem contingência PIX (single PSP) | INCONCLUSIVO |
| D04 | WhatsApp: quota Meta não monitorada | MÉDIO |
