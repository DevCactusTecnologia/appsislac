# 12 — Operational Dependencies

| Dependência | Uso | Risco operacional | Status |
|---|---|---|---|
| Lovable Cloud (DB+Auth+Storage+Realtime+Edge) | Backbone | CRÍTICO — SPOF | ✓ COMPROVADA |
| Lovable AI Gateway (Gemini 2.0 Flash) | `ai-chat`, `ai-suggest-exames`, `ai-transcribe`, `ai-speak` | ALTO — cota compartilhada | ✓ COMPROVADA |
| WhatsApp Business (Meta) | `whatsapp-*` edges | ALTO — quota Meta não monitorada | ✓ COMPROVADA |
| PIX PSP | `create-atendimento`, webhook | ALTO — sem fallback | ✓ COMPROVADA |
| Hermes-Pardini | driver | MÉDIO | ✓ COMPROVADA |
| DBSync | driver | MÉDIO | ✓ COMPROVADA |
| Lab-apoio genérico | `lab-apoio-*` | MÉDIO | ✓ COMPROVADA |
| SMTP (Supabase Auth) | Signup/reset/invite | MÉDIO — delegado ao Cloud | ✓ COMPROVADA |
| Storage (Supabase) | Buckets `tenant-*`, assinaturas, laudos | ALTO — sem backup próprio | ✓ COMPROVADA |
| Paged.js | PDF client-side | BAIXO | ✓ COMPROVADA |

## Achados
| # | Item | Severidade |
|---|---|---|
| DEP01 | SPOF Lovable Cloud | CRÍTICO |
| DEP02 | Sem multi-provider AI | MÉDIO |
| DEP03 | Sem fallback PIX/WhatsApp | ALTO |
| DEP04 | Storage sem backup próprio | ALTO |
