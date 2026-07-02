# 10 — Critical Rules

Regras cuja falha comprometeria integridade clínica, financeira, LGPD ou rastreabilidade.

## Impacto no RESULTADO / PACIENTE
1. **Auditoria dupla (analisado ≠ liberado)** — falha permitiria liberar laudo sem revisão.
2. **VR resolvido por sexo/idade/jejum/CV** — VR errado gera interpretação clínica incorreta.
3. **Bloqueio de edição pós-liberação** — sem trava, laudos assinados poderiam mudar silenciosamente.
4. **Preservação de estado clínico em `update_atendimento_tx`** — falha destruiria coletas/resultados existentes.
5. **Assinatura digital (`sign-resultado`) + hash** — falha comprometeria validade legal.
6. **Cabeçalho legal (CNES/RT completo)** — obrigatório RDC ANVISA 302/2005.

## Impacto FINANCEIRO
7. **Entradas read-only (derivadas de atendimento)** — evita divergência caixa vs operacional.
8. **CNPJ válido para recibo** — fiscalização.
9. **Estorno com justificativa** — trilha auditável.
10. **Confirmação PIX via webhook** — sem ela, quitação seria manual e passível de fraude.
11. **Precificação com prioridade `metaValor`** — recalcular apagaria negociação.

## Impacto RASTREABILIDADE / AUDITORIA
12. **Sequência protocolo/amostra por tenant** — gaps quebram rastreabilidade.
13. **`justificativa` obrigatória em edição sensível** — sem ela, auditoria fica cega.
14. **Triggers gravam `pos_finalizacao=true`** — sinaliza alteração após laudo liberado.
15. **`ai_audit` de toda tool executada** — governança IA.

## Impacto LGPD
16. **Consentimento registrado antes de coletar dados sensíveis.**
17. **Direito de deleção (`lgpd-deletar-paciente`) anonimiza sem quebrar auditoria.**
18. **Opt-out WhatsApp respeitado no dispatcher.**

## Impacto MULTI-TENANT / SEGURANÇA
19. **`tenant_id NOT NULL` + RLS 4 policies em toda tabela de domínio.**
20. **`current_tenant_id()` server-side** — nunca aceitar tenant do frontend.
21. **`is_super_admin()` revalidado em cada edge** — sem ele, escalada de privilégio.
22. **Roles em `user_roles`** — jamais em `profiles` (privilege escalation).

## Impacto MIGRAÇÃO
23. **`runtime_mode` só muda após smoke test verde.**
24. **Preservação de `password_hash`** — sem isso, todos usuários perderiam acesso.
25. **`tenant_registry` bloqueia flip prematuro (`MigrationBlockedError`).**
26. **Idempotência das fases** — repetir uma fase não pode corromper dados.

## Impacto INTEGRAÇÕES
27. **Circuit breaker + dead-letter** — evita cascata de falhas com labs de apoio.
28. **Idempotency-key em jobs** — evita duplicação.

## Impacto CLÍNICO OPERACIONAL
29. **Fluxo condicional coleta/análise (config tenant)** — se dessincronizado, sidebar direciona para rota inexistente.
30. **Marca d'água global** — laudos rascunho não podem parecer definitivos.
