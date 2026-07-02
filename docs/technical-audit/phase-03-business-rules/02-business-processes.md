# 02 — Business Processes

Detalhamento dos 20 macroprocessos.

## 1. Cadastro de Paciente
- **Entrada:** nome, CPF (único por tenant), nascimento, sexo, contato.
- **Regras:** unicidade CPF; idade calculada; consentimento LGPD (`useCompliance`).
- **Saída:** `pacientes` row + `identidade_confirmacoes` opcional.

## 2. Recepção / Solicitações Públicas
- **Entrada:** formulário público (`SolicitacoesSite`) ou lead do site (`leads-manager`).
- **Regras:** rate-limit (`public_rate_limits`), captura de exames desejados.
- **Saída:** `solicitacoes_publicas` (status: nova → em_atendimento → convertida/descartada).

## 3. Atendimento
- **Entrada:** paciente, convênio, unidade, exames, pagamentos.
- **Regras:** idempotency_key; RBAC `criar_atendimento`; preço via `pricing.ts` (metaValor → tabela convênio → Própria → 0); protocolo sequencial (`protocolo_sequence`).
- **Saída transacional (RPC `create_atendimento_tx`):** `atendimentos` + `atendimento_exames` + `atendimento_pagamentos`.
- **Edição:** `update_atendimento_tx` preserva estado clínico (IDs, resultados, analistas).

## 4. Orçamento
- Validade 30 dias; compartilhável via WhatsApp; conversão gera atendimento.

## 5. Coleta
- Opcional por config (`tenant_lab_config.registrar_coleta`). Se desligado, "Rotina" pula para Resultados.
- Estados: pendente → coletado → em_analise; reversível.
- Gera sequência amostra (`amostra_sequence`), materiais (`materiais_amostra`).

## 6. Triagem
- Alocação por setor/analista; empréstimo entre unidades (`amostra_emprestimos`).

## 7. Análise
- Opcional (`analisar_amostras`).
- Digita resultado por parâmetro (`exame_parametros`); máscara calculadora; navegação ENTER; suporte VR dinâmico (idade/sexo/jejum/risco CV) e fórmulas.

## 8. Validação Técnica (dupla auditoria)
- Analisado (analista) → Liberado (validador). Bloqueio pós-salvamento.
- Registra `atendimento_audit` (analisado_por, liberado_por, timestamps, justificativa via `set_audit_justificativa`).

## 9. Assinatura / Liberação
- `sign-resultado` gera hash + PDF assinado; `upload-assinatura` para carimbo.
- Marca de água global.

## 10. Entrega
- Portal `/consultar` (CPF+protocolo), WhatsApp automático (política `tenant_notification_settings`), impressão (Paged.js/Document Engine 3.0).

## 11. Financeiro
- Caixa: abertura/fechamento por sessão (`caixa_sessoes`).
- Entradas **read-only** derivadas de `atendimentoStore`. Saídas manuais (`financeiro_saidas`).
- Estornos exigem justificativa. Comprovantes com código FNV-1a.

## 12. Convênios
- Tabelas de preço (CBHPM/TUSS/Própria); competências mensais; faturas; glosas com motivos.

## 13. Produção / Mapa
- KPIs por setor/analista; mapa densificado.

## 14. Estoque
- Insumos + lotes + fornecedores; movimentações; alerta de validade.

## 15. Soroteca
- Estruturas (galerias × posições); armazenagem pós-análise; expurgo lotado.

## 16. Integrações Labs de Apoio
- Envio XML/HTTP; polling resultados; PDFs; circuit breaker (`provider_circuit_state`); dead-letter (`integration_dead_jobs`).

## 17. WhatsApp
- Outbox → dispatcher → Meta. Política `automatic|manual` por tipo.

## 18. Auditoria
- Triggers em domínio → `audit_logs`, `atendimento_audit`, `operational_audit`, `storage_audit`, `financeiro_audit`.

## 19. Super Admin / Migração
- Fases: schema → data → auth → storage → smoke → flip → purge shared.
- Roles em `user_roles` (`super_admin`).

## 20. IA / LGPD
- Tools por permissão (`ai_audit`). LGPD: consentimento, deleção, relatório.
