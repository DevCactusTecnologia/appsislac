# CORE FREEZE — Plataforma de Inteligência do SISLAC

**Data:** Fase 2.2 concluída.
**Status:** ✅ **CORE OFICIALMENTE CONGELADO.**

## Componentes congelados
A partir desta data, os seguintes componentes **não podem ser alterados** por novas Skills, Capabilities ou Actions. Mudanças nestes arquivos exigem nova Fase formal do Core.

| Componente | Arquivo | LoC |
| --- | --- | --- |
| AI Shell | `src/components/ai-shell/AiShell.tsx` | 243 |
| Context Engine | `src/lib/ai/contextEngine.ts` | 78 |
| Manifest Client | `src/lib/ai/manifestClient.ts` | 116 |
| Capability Registry (SSOT) | `supabase/functions/_shared/registry.ts` | 165 |
| Edge Bootstrap | `supabase/functions/_shared/aiAuth.ts` | 73 |
| Edge ai-chat | `supabase/functions/ai-chat/index.ts` | 93 |
| Edge ai-manifest | `supabase/functions/ai-manifest/index.ts` | 22 |
| **Total Core** | — | **790** |

(Skills, como `ai-chat/skills/paciente.ts`, **não fazem parte do Core** — podem evoluir livremente.)

## Modelo de evolução pós-freeze
Toda nova funcionalidade do Assistente deve ocorrer **exclusivamente** por:

```
Capability (registry.ts)
        ↓
Action (skill tool)
        ↓
Serviço Oficial (store / RPC / Edge dedicado)
        ↓
Banco (com RLS)
```

**Permitido:**
- Adicionar entradas em `CAPABILITIES`.
- Criar novas Skills em `supabase/functions/ai-chat/skills/`.
- Criar novas Actions oficiais consumidas pelas Skills.

**Proibido sem nova Fase do Core:**
- Alterar `AiShell`, `contextEngine`, `manifestClient`, `aiAuth`, `registry`, `ai-chat/index.ts`, `ai-manifest/index.ts`.
- Criar novas Edge Functions do Assistente além de `ai-chat` e `ai-manifest`.
- Criar novas tabelas `ai_*`.
- Adicionar camadas, contextos globais ou providers para o Assistente.
- Declarar Capabilities fora de `_shared/registry.ts`.

## Garantias
- ✓ SSOT única para Capabilities.
- ✓ Manifest derivado, nunca hardcoded.
- ✓ Bootstrap único para Edge Functions.
- ✓ Avatar visível em 100% das rotas autenticadas.
- ✓ Zero duplicação entre `ai-chat` e `ai-manifest`.
- ✓ Multi-tenant sempre server-side (`current_tenant_id()`).
- ✓ Permissões sempre via `has_permission()`.

**O Core está pronto para receber Skills de forma incremental.**
