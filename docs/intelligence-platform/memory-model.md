# Memory Model

## Separação obrigatória de níveis
| Nível | Escopo | Tabela / lugar | TTL | Conteúdo |
|---|---|---|---|---|
| **Contexto temporário** | Requisição atual | Em memória (Edge) | requisição | Envelope `AIContext` |
| **Conversa** | Thread aberta | `ai_threads` + `ai_messages` | até o usuário apagar | Texto enviado/recebido, ids de tool_calls |
| **Preferências do usuário** | Por usuário | `ai_user_prefs` | persistente | tom de resposta, atalhos, opt-in de proativo |
| **Memória do tenant** | Por tenant | `ai_tenant_memory` (opcional, fase 2) | persistente | glossário de exames específicos do lab, abreviações |
| **Histórico (auditoria)** | Por tenant | `ai_audit` | retenção legal | execução de tools |

## Regras absolutas
- **Nunca persistir** dados clínicos (resultados, valores, laudos), dados financeiros brutos, dados pessoais sensíveis dentro de `ai_messages` ou `ai_user_prefs`.
- Mensagens armazenam **texto livre** do usuário e **texto** do assistente; argumentos/retornos de tools são armazenados como **resumos** (hashes/IDs), não payload completo.
- Cross-tenant: zero. RLS por `(tenant_id, user_id)`.

## Estrutura mínima (a confirmar na fase de implementação)
```
ai_threads(id, tenant_id, user_id, title, created_at, updated_at, archived_at)
ai_messages(id, thread_id, tenant_id, user_id, role, content, tool_calls_summary jsonb, created_at)
ai_user_prefs(user_id, tenant_id, prefs jsonb, updated_at)
ai_audit(id, tenant_id, user_id, skill, action_id, input_hash, output_summary, duration_ms, status, approved, error_code, created_at)
ai_tenant_memory(id, tenant_id, key, value jsonb, updated_by, updated_at)
```
Todas com 4 policies RLS + GRANT padrão (ver `multitenant-model.md`).

## Ciclo de vida
- Thread arquivada após **90 dias** sem atividade.
- Mensagens expurgadas após **180 dias** (configurável por tenant — LGPD).
- Auditoria retida conforme política regulatória já existente em `src/lib/regulatorio.ts`.
- Preferências sobrevivem; reset manual pelo usuário.

## Invalidação
- `SIGNED_OUT` → limpa caches do AI Shell.
- Troca de tenant (super_admin impersonate) → nova thread.

## O que a IA NÃO lembra
- Senhas, tokens, JWT.
- CPF / RG / dados de pagamento.
- Texto completo de resultados liberados.
- Conteúdo de mensagens WhatsApp enviadas.
- Anexos.
