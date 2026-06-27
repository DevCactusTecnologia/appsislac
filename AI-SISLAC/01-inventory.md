# 01 — Inventário Completo do Assistente SISLAC

> Fase OLHOU. Nenhum código alterado. Levantamento físico de arquivos, LoC e consumidores.

## 1. Arquivos de código

### Frontend (`src/`)
| Arquivo | LoC | Responsabilidade | Consumidores |
|---|---|---|---|
| `src/components/assistente/AssistenteSISLAC.tsx` | 420 | Único componente do Assistente. Botão flutuante + painel + pipeline texto/voz. Inclui `parseLocalIntent` (navegação local) e `streamAiChat` (SSE da edge). | `src/App.tsx` (1) |
| `src/lib/ai/contextEngine.ts` | 78 | Hooks `useAIContext` e `getContextualSuggestions`. | **Nenhum consumidor real** — só self-import. |
| `src/lib/ai/manifestClient.ts` | 117 | Hook `useManifest`, cache TTL 5min, `discoverCapabilities`. | **Nenhum consumidor real** — só self-import. |

### Backend / Edge Functions (`supabase/functions/`)
| Função | LoC | Responsabilidade | Consumidores |
|---|---|---|---|
| `ai-chat/index.ts` | 162 | Boundary única LLM (Gemini 2.5 Flash). Streaming + tool calling + auditoria. | `AssistenteSISLAC.tsx` |
| `ai-chat/skills/paciente.ts` | 105 | Tools `paciente_search`, `paciente_create`, `paciente_exames`. | `ai-chat` |
| `ai-chat/skills/atendimento.ts` | 139 | Tools `atendimento_count`, `atendimento_summary`. | `ai-chat` |
| `ai-chat/skills/resultado.ts` | 272 | Tools `resultado_open`, `resultado_set_valor`, `resultado_set_varios`. | `ai-chat` |
| `ai-manifest/index.ts` | 22 | Entrega Manifest filtrado por permissão. | **Nenhum consumidor real** — `useManifest` (cliente) está órfão. |
| `ai-speak/index.ts` | 49 | TTS via Lovable AI Gateway (`openai/gpt-4o-mini-tts`). | `AssistenteSISLAC.tsx` |
| `ai-transcribe/index.ts` | 46 | STT via Lovable AI Gateway (`openai/gpt-4o-mini-transcribe`). | `AssistenteSISLAC.tsx` |
| `_shared/aiAuth.ts` | 73 | SSOT bootstrap (CORS, JWT, tenant, perms). | `ai-chat`, `ai-manifest`, `ai-speak`, `ai-transcribe` |
| `_shared/registry.ts` | 273 | Capability Registry (8 entradas) + `buildManifest`. | `ai-chat`, `ai-manifest`, `_shared/aiAuth` |

**Total LoC operacional**: ~1.756 linhas.

## 2. Tabelas de banco (`public.ai_*`)

| Tabela | Colunas | Consumidor no código | Status |
|---|---|---|---|
| `ai_audit` | 15 | `ai-chat/index.ts` (insert no `onFinish` e em erro). | **EM USO** |
| `ai_threads` | 9 | Apenas tipo em `types.ts`. Nenhum insert/select. | **MORTA** |
| `ai_messages` | 10 | Apenas tipo em `types.ts`. Nenhum insert/select. | **MORTA** |
| `ai_user_preferences` | 6 | Apenas tipo em `types.ts`. | **MORTA** |
| `ai_metrics_daily` | 15 | Apenas tipo em `types.ts`. | **MORTA** |

## 3. Documentação

| Pasta | Arquivos | LoC | Estado |
|---|---|---|---|
| `docs/intelligence-platform/` | 78 | ~3.500 | Histórico de fases (Phase 2, 2.1, 2.2, 2.3, 2.4, hotfixes, freezes). Muitos relatórios obsoletos coexistindo (`executive-report.md`, `-final.md`, `-hotfix2.md`, `-phase2X.md`). |
| `docs/assistant-knowledge/` | 15 | ~650 | Manuais de domínio. **Nenhum carregado em runtime** — não há RAG nem fetch. |

## 4. Dependências externas

| Pacote | Origem | Uso |
|---|---|---|
| `npm:ai@5.0.206` | Vercel AI SDK | `streamText`, `tool`, `stepCountIs`, `convertToModelMessages` |
| `npm:@ai-sdk/openai-compatible@1.0.41` | AI SDK | Provider Lovable Gateway |
| `npm:zod@3.23.8` | Zod | Schemas de tools |
| `@elevenlabs/react` | — | **Removida**. Resta apenas comentário "Zero dependência" em `AssistenteSISLAC.tsx:5`. |

## 5. Secrets / variáveis

| Nome | Origem | Uso |
|---|---|---|
| `LOVABLE_API_KEY` | Lovable Cloud | `ai-chat`, `ai-speak`, `ai-transcribe` |
| `SUPABASE_URL` / `SERVICE_ROLE_KEY` / `ANON_KEY` | Lovable Cloud | `aiAuth.ts` |
| `ELEVENLABS_*` | — | **Não existe mais**. Migração `drop_elevenlabs_config.sql` aplicada. |

## 6. Consolidado

- **3 arquivos** no frontend (1 ativo + 2 órfãos).
- **9 arquivos** no backend (todos ativos).
- **5 tabelas** `ai_*` (1 ativa, 4 mortas).
- **8 Capabilities** registradas.
- **93 docs** sobre o assistente (apenas ~15 ainda fazem sentido operacional).
