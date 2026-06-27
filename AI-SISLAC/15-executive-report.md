# 15 — Relatório Executivo Final

> AI-SISLAC 1.0 — Radiografia completa do Assistente. Fase OLHOU + ENTENDEU + MAPEOU + VALIDOU + RECOMENDOU. Nenhum código alterado.

## TL;DR
O Assistente **funciona** para o caminho ativo (texto + voz push-to-talk + 8 tools), mas **mais da metade da arquitetura prometida é esqueleto sem músculo**: Manifest, Discovery, Memory, Knowledge Base e parte do Capability Registry existem em código/banco mas não têm consumidor. ElevenAgents foi removido com sucesso e não deixa conflito. A recomendação técnica é **(B) Simplificar a arquitetura** — manter o caminho operacional, remover o esqueleto morto.

## Respostas objetivas às perguntas da auditoria

| Pergunta | Resposta |
|---|---|
| O Assistente está pronto para produção? | Para o escopo implementado (busca/abrir/inserir valor): **sim, com 2 correções de segurança**. Para o escopo prometido (BPA, WhatsApp, Financeiro, etc.): **não**. |
| Toda a arquitetura atual é necessária? | **Não.** ~400 LoC + 4 tabelas + 15 docs + 1 edge function (`ai-manifest`) + 2 arquivos frontend (`contextEngine`, `manifestClient`) podem ser removidos sem perda. |
| Existe complexidade desnecessária? | **Sim**: Manifest, Discovery, Quick Actions, Memory, `actions[]`, `priority`, `color`, `icon`, `baseline*`. |
| Existe código morto? | **Sim**: ver tabela em `13-simplification.md`. |
| Existe duplicação? | **Sim**: rotas em 3 lugares; regras de comportamento em prompt + 2 docs + tool descriptions; `set_valor ⊂ set_varios`. |
| Existe acoplamento excessivo? | **Não**. Acoplamentos vivos são apropriados (servidor SSOT). Os acoplamentos mortos resolvem-se removendo o lado órfão. |
| Existe sobreposição entre ElevenLabs e SISLAC? | **Não mais** — ElevenLabs foi removido. |
| O fluxo de execução é simples, previsível e auditável? | **Simples e previsível, sim**. **Auditável: parcialmente** — `ai_audit` registra turnos, não tools individuais. |
| O Assistente continua fiel ao objetivo? | **Sim**, mas a regra "≤8 palavras" no prompt sabota o modo texto. |

## Filosofia
O Assistente ainda segue **"responder e executar tarefas"**. Não virou segundo sistema. Mas o **andaime conceitual** (Manifest/Discovery/Memory/Knowledge) está pedindo para virar segundo sistema — recomenda-se cortar antes que cresça.

## Recomendação final

**B) SIMPLIFICAR ARQUITETURA**

Justificativa:
- (A) Manter atual = pagar manutenção de ~400 LoC + 4 tabelas + 78 docs sem retorno.
- (C) Remover ElevenAgent = **já feito**.
- (D) STT+TTS simples = **já é o estado atual**.
- (E) Refazer = jogar fora o caminho que funciona; risco maior que benefício.
- (B) Cortar o esqueleto morto, manter o core (`ai-chat` + 3 skills + ai-speak + ai-transcribe + AssistenteSISLAC.tsx) e endurecer 3 pontos (aprovação real, auditoria por tool, rate limit).

## Plano de ação priorizado

### P0 — Risco de segurança (1 dia)
1. **`needsApproval` real**: bloquear no frontend a chamada de `resultado.set_*` sem confirmação explícita do usuário (não confiar no LLM).
2. **Rate limit** por `user_id` em `ai-chat`, `ai-speak`, `ai-transcribe`.

### P1 — Limpeza (1 dia, alto ganho, baixo risco)
3. DROP das tabelas `ai_threads`, `ai_messages`, `ai_user_preferences`, `ai_metrics_daily` (DROP IF EXISTS).
4. Deletar `src/lib/ai/manifestClient.ts`, `src/lib/ai/contextEngine.ts`, `supabase/functions/ai-manifest/`.
5. Reduzir `_shared/registry.ts` aos campos realmente usados (`id`, `permission`, `needsApproval`, `category`, `description`).
6. Fundir `resultado.set_valor` em `resultado.set_varios`.

### P2 — Performance (0,5 dia)
7. Substituir N `has_permission` por 1 RPC `get_user_permissions(user_id)` cacheada in-memory por edge.
8. Cache de `auth.getUser` por requisição (compartilhar entre `aiAuth` e callers).

### P3 — Qualidade (1 dia)
9. Separar prompt: regras de voz **só** quando `context.mode === 'voice'`. Modo texto sem limite de 8 palavras.
10. Auditoria por tool: insert em `ai_audit` dentro de cada `execute()`, não só no `onFinish`.
11. Aumentar `stepCountIs(5)` → `stepCountIs(15)` (fluxos multi-step reais).

### P4 — Documentação (0,5 dia)
12. Consolidar `docs/intelligence-platform/` (78 arquivos) em 3-5 docs vivos.
13. Decidir: ativar RAG sobre `docs/assistant-knowledge/` **ou** deletar a pasta.

## Critério de sucesso
| Critério | Status atual | Após P0+P1 |
|---|---|---|
| Pronto para produção (escopo atual) | ⚠️ | ✅ |
| Arquitetura toda necessária | ❌ | ✅ |
| Sem código morto relevante | ❌ | ✅ |
| Sem duplicação | ❌ | ✅ |
| Sem sobreposição ElevenLabs | ✅ | ✅ |
| Fluxo simples/previsível/auditável | ⚠️ (auditoria) | ✅ |
| Fiel ao objetivo | ✅ | ✅ |
| Plano de simplificação claro | ❌ | ✅ (este doc) |

---

**Regra de parada respeitada.** Nenhum arquivo de produção alterado. Próxima fase requer aprovação explícita.
