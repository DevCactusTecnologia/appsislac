# /novo-atendimento — Relatório Executivo

> Auditoria 100% somente-leitura. Nada foi alterado no código.

## Diagnóstico binário

| Pergunta | Resposta | Justificativa |
|---|---|---|
| A lógica de negócio está correta? | **SIM** | Validações de obrigatoriedade, cobrança híbrida, desconto proporcional, hidratação de edição, RBAC server-side e persistência transacional estão consistentes com as regras documentadas em memória e nos governance docs. |
| Existem riscos críticos? | **SIM** (1) | Monólito de **2.598 linhas** com **~38 useState** num único componente. Não é bug; é dívida estrutural com efeito composto sobre todas as outras mudanças. |
| Existem bugs potenciais? | **SIM** (3 baixos) | (a) `examesCatalogoLegado` importado e não usado — ruído, sem impacto runtime. (b) `editAtendimentoData` usado como "sinal" de re-render — frágil a refactors. (c) Strings mágicas (`Particular`, `SEM SOLICITANTE`, `__ambos`) sem constantes — quebra silenciosa se algum tenant remover Particular ou se a sentinel mudar. |
| Existe complexidade desnecessária? | **SIM** | Preço de exame replicado 4× (fallback `getPrecoExame ?? "Própria" ?? 0`). Payload `examesCobranca` duplicado em `addAtendimento` e `updateAtendimento`. Normalizador NFD redeclarado inline. Status de pagamento derivado 2× no mesmo arquivo (parte do hotspot global já mapeado). |
| O fluxo é simples para manutenção? | **NÃO** | Um único arquivo conhece 9 stores, 7 dialogs lazy, IA, soroteca, OCR, prefill web, cobrança híbrida, lab apoio, desconto e edição. Qualquer evolução exige reler 2.598 linhas. |
| O fluxo está preparado para produção real? | **SIM** | Persistência via edge function + RPC transacional (`create_atendimento_tx`/`update_atendimento_tx`) com BEGIN/COMMIT/ROLLBACK automático; RLS em todas as tabelas; tenant_id resolvido server-side por `current_tenant_id()`; RBAC server-side por `has_permission`; lazy loading dos dialogs pesados; fallback server-side em edição quando o cache local está vazio. |
| O fluxo está preparado para múltiplos laboratórios? | **SIM** | Isolamento multi-tenant blindado por RLS + resolver server-side. Frontend nunca envia `tenant_id`. Restrição residual: caches globais Zustand precisam de reset em troca de tenant (impersonation super_admin) — coberto pela governança de cache, não por este componente. |
| O fluxo precisa de refatoração imediata? | **NÃO** | Está estável, correto e em produção. A refatoração é **recomendada** mas **não urgente** — pode ser planejada como Sprint dedicada, não como hotfix. |

## Pontos fortes confirmados

1. **Transacionalidade real** — escrita inteira passa por RPC; nenhum
   estado parcialmente persistido em caso de erro.
2. **Defesa em profundidade** — RBAC validado nas edge functions além do
   frontend.
3. **Isolamento multi-tenant intocável** — tenant_id nunca trafega do
   cliente; RLS + `current_tenant_id()` fazem o trabalho.
4. **Performance perceptível** — 7 dialogs pesados em `lazy()` reduzem o
   bundle inicial; fallback server-side evita travas em edição.
5. **Regras críticas centralizadas** — `resolveCobrancaDefault`,
   distribuição de desconto, política de bloqueio clínico
   (`isEdicaoClinicaBloqueada`) e derivação de status server-side.

## Hotspots (referência para próximas Sprints)

1. **Extrair preço de exame** para função pura única; remover as 3
   reimplementações inline.
2. **Extrair `buildExamesCobrancaPayload`** — elimina duplicação entre
   create e update.
3. **Constantes para strings mágicas** — `PARTICULAR`, `SEM_SOLICITANTE`,
   `SOLICITANTE_AMBOS`.
4. **Remover `examesCatalogoLegado`** e seu import.
5. **Trocar `editAtendimentoData` como sinal** por um hook de fetch
   explícito.
6. **Slicing estrutural Sprint 2** — separar Steps (Paciente, Convênio,
   Exames, Resumo) em sub-componentes próprios. O Sprint 1 já fez o
   slicing inicial dos helpers; o componente principal continua monolítico.
7. **Adotar `lib/finance/statusPagamento.ts`** quando a governança
   global executar a extração já planejada.

## Resposta às perguntas de fechamento

> **Como a página /novo-atendimento realmente funciona?**

Um wizard de 4 passos que coleta paciente, convênio/solicitante, exames
(com IA, OCR de requisição e reuso de amostra) e pagamento, derivando
totais com cobrança híbrida paciente/convênio e distribuição
proporcional de desconto. No submit, chama uma única edge function
(`create-atendimento` ou `update-atendimento`) que executa uma RPC
transacional no Postgres, com tenant_id resolvido server-side e RBAC
validado por permissão. Após sucesso, exibe protocolo + métricas de
etiqueta e dispara fluxos downstream (coleta/processamento/resultado)
via status persistido.

> **Continuará simples, estável e sustentável daqui a 2 anos?**

**Estável e sustentável: SIM.** A arquitetura backend (RPC + RLS +
edge functions) é sólida e absorve crescimento de tenants e volume.

**Simples: NÃO, sem intervenção.** O monólito de 2.598 linhas tende a
crescer junto com novas regras (IA, soroteca, integrações). Sem o
slicing planejado (Sprint 2), em 2 anos o arquivo será
significativamente maior e mais frágil a evoluções concorrentes. Isso
é **dívida técnica gerenciável**, não risco operacional.

## Regra de parada respeitada

✅ Nenhum arquivo de código foi modificado.
✅ Nenhuma refatoração foi iniciada.
✅ Apenas relatórios em `docs/audits/novo-atendimento/` foram gerados.
