# 09 — Runtime Dependencies

## Obrigatórias em todo fluxo autenticado
- `src/integrations/supabase/client.ts` (cliente único).
- `src/runtime/db.ts` (contexto tenant + invalidação).
- `AuthContext` (profiles + user_roles).
- RLS + `current_tenant_id()`.

## Obrigatórias por domínio
| Fluxo | Dependências |
|---|---|
| Atendimento | `atendimentoStore`, edge `create-atendimento`, RPC `create_atendimento_tx`, `pricing.ts`, `atendimentoPolicy.ts` |
| Resultado | `exameParametrosStore`, `valoresReferenciaStore`, `reguasEtariasStore`, `laudoHtmlBuilder`, Paged.js, `sign_resultado_tx` |
| Financeiro | `atendimentoStore` (fonte única de Entradas), `register_pagamento_tx`, `pixBrCode.ts` |
| Amostras | `sorotecaStore`, `move_amostra_tx` |
| Integrações | `_shared/drivers/pipeline.ts`, `circuit.ts`, `dlq.ts`, `integration_jobs` |
| Migração | 24 edges `super-admin-migration-*`, `tenant_registry`, `tenant_migration_runs` |
| IA | `ai-chat` edge, Lovable AI Gateway (Gemini 2.0 flash), `_shared/aiAuth` |

## Opcionais (feature flags via `tenant_lab_config`)
- Registrar coleta / analisar amostras.
- Módulo de integrações apoio.
- WhatsApp (envios).
- IA (chat/voz/OCR).

## Externas
- Supabase (Auth/DB/Storage/Realtime/Functions).
- Lovable AI Gateway.
- PSP PIX (webhook).
- Provedores de apoio (DBSync, Hermes-Pardini).
- Paged.js (renderização PDF client-side).
