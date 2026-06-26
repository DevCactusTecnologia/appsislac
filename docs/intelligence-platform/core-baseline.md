# Core Baseline — Métricas de Saúde (Fase 2.3)

Baseline oficial registrado em Fase 2.3. Serve como referência fixa para detectar crescimento descontrolado.
**Qualquer crescimento >10% em LoC ou nº de arquivos do Core exige justificativa formal e nova Fase.**

## Tamanho do Core

| Componente | Arquivo | LoC |
| --- | --- | --- |
| AI Shell | `src/components/ai-shell/AiShell.tsx` | 243 |
| Context Engine | `src/lib/ai/contextEngine.ts` | 78 |
| Manifest Client | `src/lib/ai/manifestClient.ts` | 116 |
| Capability Registry | `supabase/functions/_shared/registry.ts` | 165 |
| Edge Bootstrap | `supabase/functions/_shared/aiAuth.ts` | 73 |
| Edge ai-chat | `supabase/functions/ai-chat/index.ts` | 93 |
| Edge ai-manifest | `supabase/functions/ai-manifest/index.ts` | 22 |
| **TOTAL CORE** | — | **790** |

## Contagens

| Métrica | Valor baseline |
| --- | --- |
| Arquivos do Core | **7** |
| Componentes lógicos | **7** (AI Shell, Context Engine, Manifest Client, Registry, aiAuth, ai-chat, ai-manifest) |
| Edge Functions de IA | **2** (`ai-chat`, `ai-manifest`) |
| Tabelas `ai_*` | **5** (`ai_threads`, `ai_messages`, `ai_audit`, `ai_user_preferences`, `ai_metrics_daily`) |
| Capabilities ativas | **2** (`paciente.search`, `paciente.create`) |
| Skills ativas | **1** (`paciente`) |
| Versão do Manifest | `2.1.0` |

## Dependências externas do Core

| Camada | Dependências |
| --- | --- |
| Frontend Core | `react`, `react-router-dom`, `lucide-react`, `@/integrations/supabase/client`, `@/contexts/AuthContext`, `@/components/ui/{button,sheet,textarea}` |
| Edge Core | `npm:ai@4.3.16`, `npm:@ai-sdk/openai-compatible@0.2.16`, `@supabase/supabase-js@2.45.0`, `deno.land/std@0.224.0` |

Total de dependências diretas do Core: **9** (4 internas + 5 externas).
Adição de dependência nova ao Core exige nova Fase formal.

## Latência operacional (alvo)

| Operação | Alvo p95 |
| --- | --- |
| Abertura do AI Shell (Drawer) | < 80 ms (Manifest cacheado em memória + `cache-control: private, max-age=60`) |
| Primeira chamada `ai-manifest` por sessão | < 300 ms |
| Chamadas subsequentes `ai-manifest` | servidas do cache do `manifestClient` (0 ms) |
| TTFB de `ai-chat` (streaming) | < 1.2 s |

Medições reais devem ser registradas em `ai_metrics_daily` e revisadas trimestralmente.

## Regras de evolução do baseline

1. Aumento ≤10% em LoC do Core → permitido sem cerimônia, mas registrado.
2. Aumento >10% em LoC, +1 arquivo no Core, +1 Edge de IA, +1 tabela `ai_*` → **nova Fase formal obrigatória**.
3. Skills/Capabilities/Actions crescem livremente — não impactam este baseline.

## Snapshot

- Data: Fase 2.3.
- Estado: Core **congelado** desde Fase 2.2.
- Próxima revisão obrigatória: ao final da Fase 3 (Skills de domínio).
