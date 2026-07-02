# 02 — Flow Map

Inventário de fluxos executáveis, agrupados por domínio.

## Cadastros
1. Cadastro / edição de Paciente
2. Cadastro / edição de Convênio, Tabela de Preço, Especialista, Unidade, Setor, Material, Local, Fornecedor, Insumo
3. Cadastro / edição de Exame (catálogo, parâmetros, layouts, réguas, VR, POPs)

## Atendimento
4. Criação de Atendimento (wizard `NovoAtendimento`)
5. Edição / rehidratação de Atendimento
6. Cancelamento de Atendimento (motivo obrigatório)
7. Alteração de Exames do Atendimento
8. Registro de Coleta (opcional por `tenant_lab_config`)
9. Registro de Análise (opcional por `tenant_lab_config`)

## Resultado e Laudo
10. Digitação de resultado (`ResultadoDetalhe`)
11. Auditoria dupla (Analisado → Liberado) via `sign_resultado_tx`
12. Geração de laudo HTML → Paged.js → PDF
13. Impressão em lote (`laudoBatchPdf.ts`)
14. Entrega de resultado (`resultados_entregas`)

## Financeiro
15. Registro de pagamento (`register_pagamento_tx`)
16. Geração de PIX dinâmico + confirmação por webhook
17. Impressão de comprovante (via `comprovante-resolve`, shortlink `/p/:codigo`)
18. Abertura/fechamento de caixa (`open_caixa_tx`, `close_caixa_tx`)
19. Registro de saída financeira
20. Estorno formal (`financeiro_estornar`)
21. Fatura de convênio (fechamento, glosas)

## Soroteca / Amostras
22. Movimentação de amostra (`move_amostra_tx`)
23. Empréstimo (`emprestar_amostra_tx`)
24. Expurgo em lote (`expurgar_amostras_tx`)

## Integrações
25. Envio a laboratório de apoio (DBSync / Hermes-Pardini)
26. Polling de resultados (`integration-poll-results`)
27. Resolução de PDFs (`integration-pdf-resolve`, `integration-pdf-url`)
28. Job runner (`integration-jobs-runner`) + circuit breaker + DLQ

## Público
29. Landing / inscrição (`leads-manager`)
30. Site do tenant (`/site/:slug`)
31. Verificação pública de comprovante (`/verificar/:codigo`)
32. Solicitação pública de exames

## IA
33. Chat (`ai-chat`), voz (`ai-transcribe`, `ai-speak`), OCR (`extract-requisicao-exames`), sugestão (`ai-suggest-exames`)

## Plataforma / Super Admin
34. Login (`LoginV2` + `supabase.auth.signInWithPassword`)
35. Provisionamento de tenant
36. Migração shared → dedicated (24 edge functions)
37. Flip / rollback / purge
38. Impersonação / smoke test / snapshot / backup

## Auditoria e observabilidade
39. Escrita em `*_audit` via trigger
40. Realtime broadcast → refetch por subscribers

Total inventariado: **40 fluxos executáveis principais**.
