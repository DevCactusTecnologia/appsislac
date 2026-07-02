# 05 — State Machine

Estados observados por entidade.

## Atendimento (`atendimentos.status`)
```
Aguardando coleta → Em coleta → Aguardando análise → Em análise
    → Resultado digitado → Resultado analisado → Resultado liberado
    → Entregue
      ↘ Cancelado (via motivo)
```
- **Criador:** `create_atendimento_tx` (recepção).
- **Alteradores:** coleta, análise, validação, entrega.
- **Finalizador:** liberação de resultado + entrega.
- **Derivado:** status inferido pelos estados dos exames (`domain/status-automacao`).

## Exame do atendimento (`atendimento_exames.status`)
```
pendente → coletado → em_analise → digitado → analisado → liberado
                ↘ recoleta_solicitada → pendente
                ↘ terceirizado_enviado → terceirizado_recebido → digitado
```

## Amostra (`amostras.status`)
`registrada → alocada → em_uso → armazenada (soroteca) → expurgada`

## Pagamento (`atendimento_pagamentos` agregado)
`aberto → parcial → quitado → estornado`
- Quitado oculta "Gerar QRCode/Atualizar"; exibe "Imprimir comprovante".

## Resultado (validação dupla)
`vazio → digitado → analisado(analista+ts) → liberado(validador+ts) → assinado`
Após `liberado` → edição bloqueada; alteração exige justificativa e marca `pos_finalizacao`.

## Convênio Fatura (`convenio_faturas.status`)
`aberta → fechada → enviada → paga | glosada_parcial | glosada_total`

## Solicitação Pública (`solicitacoes_publicas.status`)
`nova → em_atendimento → convertida | descartada`

## Coleta Recoleta (`recoletas.status`)
`solicitada → aceita → executada → concluida | recusada`

## Integração Job (`integration_jobs.status`)
`queued → running → success | retrying → dead (→ integration_dead_jobs)`

## Circuit Breaker (`provider_circuit_state.state`)
`closed → open → half_open → closed`

## Migração Tenant (`tenant_migration_runs.phase`)
`schema → data → auth → storage → smoke → flip → post_flip | rollback`
`runtime_mode`: `shared → dual → isolated_db`.

## Caixa Sessão
`aberto → fechado (com conferência) → auditado`

## Estoque Lote
`ativo → em_uso → vencido → descartado`

## Soroteca / Expurgo Lote
`preparado → aprovado → executado → arquivado`

## WhatsApp Outbox
`pending → sending → sent → delivered | failed → dead`

## Consentimento LGPD
`ativo → revogado → deletado (anonimização)`
