# Core Final Freeze — Plataforma de Inteligência do SISLAC

**Data:** Fase Final concluída.
**Status:** ✅ **CORE DEFINITIVAMENTE CONGELADO. ARQUITETURA ENCERRADA.**

Este documento substitui e ratifica `core-freeze.md` (Fase 2.2) como o congelamento DEFINITIVO. Não haverá novas fases estruturais.

## Componentes imutáveis
| Componente | Arquivo | LoC |
| --- | --- | --- |
| AI Shell | `src/components/ai-shell/AiShell.tsx` | 336 |
| Context Engine | `src/lib/ai/contextEngine.ts` | 78 |
| Manifest Client | `src/lib/ai/manifestClient.ts` | 116 |
| Capability Registry (SSOT) | `supabase/functions/_shared/registry.ts` | 165 |
| Edge Bootstrap | `supabase/functions/_shared/aiAuth.ts` | 73 |
| Edge `ai-chat` | `supabase/functions/ai-chat/index.ts` | 93 |
| Edge `ai-manifest` | `supabase/functions/ai-manifest/index.ts` | 22 |
| Edge `ai-transcribe` (adapter STT) | `supabase/functions/ai-transcribe/index.ts` | 48 |
| **Total Core** | — | **931** |

Skills (`supabase/functions/ai-chat/skills/*`) NÃO fazem parte do Core e podem evoluir livremente.

## Regras permanentes (proibições absolutas)
A partir desta data, é PROIBIDO sem nova fase formal do Core (que NÃO ocorrerá):
- ❌ Criar novo Registry.
- ❌ Criar novo Context.
- ❌ Criar novo Provider.
- ❌ Criar novo Manifest.
- ❌ Criar nova Edge Function do Assistente além das 3 oficiais.
- ❌ Criar nova tabela `ai_*`.
- ❌ Adicionar camadas, motores ou engines paralelos.
- ❌ Alterar qualquer arquivo da tabela acima.
- ❌ Declarar Capabilities fora de `_shared/registry.ts`.

## Único caminho de evolução
```
Capability (registry.ts)
        ↓
Skill (ai-chat/skills/*.ts)
        ↓
Action (chama serviço oficial)
        ↓
Store / RPC / Edge Function JÁ EXISTENTE
```

## Garantias finais
- ✓ SSOT única para Capabilities.
- ✓ Manifest derivado server-side, nunca hardcoded.
- ✓ Bootstrap único (`aiAuth.ts`).
- ✓ Multi-tenant sempre via `current_tenant_id()`.
- ✓ Permissões sempre via `has_permission()`.
- ✓ Auditoria 100% em `ai_audit`.
- ✓ Voz e texto compartilham o mesmo pipeline.
- ✓ Zero duplicação de regra de negócio.
- ✓ Zero arquitetura paralela.

## Declaração oficial
> **O desenvolvimento estrutural da Plataforma de Inteligência do SISLAC está oficialmente encerrado.**
> A partir desta data, toda evolução do Assistente ocorrerá exclusivamente através de novas Capabilities, Skills e Actions, reutilizando o Core existente e os serviços oficiais do SISLAC.
