# 11 — Operational Sequences

## S1. Sequência principal (happy path)
```
Paciente
  ↓ (site público OU balcão)
Solicitação/Recepção
  ↓
Cadastro/Match Paciente  (LGPD consent)
  ↓
Novo Atendimento  (protocolo + preço + pagamento)
  ↓
Coleta [CFG registrar_coleta]
  ↓
Triagem / Alocação
  ↓
Análise [CFG analisar_amostras]
  ↓
Digitação Resultado + VR
  ↓
Auditoria dupla (Analisado → Liberado)
  ↓
Assinatura (RT)  → PDF Document Engine
  ↓
Entrega (Portal / WhatsApp / Presencial)
  ↓
Financeiro (quitação PIX/dinheiro/cartão)
  ↓
Auditoria transversal (triggers em cada etapa)
```

## S2. Variação — sem coleta (config OFF)
```
Atendimento → Análise → Resultado → Laudo → Entrega
```

## S3. Variação — exame terceirizado
```
Atendimento → integration-dispatch → Job → Provider (XML/HTTP)
  → polling → integration_pdfs → digitação/anexo → Laudo → Entrega
```

## S4. Variação — recoleta
```
Análise → detecta inconsistência → recoleta.solicitada
  → coleta nova amostra → análise → resultado
```

## S5. Variação — resultado crítico
```
Digitação → criticoChecker sinaliza → criticos_comunicacoes
  → notificação obrigatória ao solicitante → liberação
```

## S6. Variação — orçamento
```
Balcão/Site → Orçamento (30d) → WhatsApp → aceito → converte em Atendimento
```

## S7. Variação — convênio (faturamento)
```
Atendimento(cobranca=convenio) → competência aberta
  → convenio_fatura_itens → fatura fechada → enviada
  → paga | glosa → convenio_glosas (motivo)
```

## S8. Variação — cancelamento
```
Atendimento (qualquer status) → motivo obrigatório
  → status "Cancelado" → auditoria com justificativa
```

## S9. Variação — edição pós-liberação
```
Editar atendimento finalizado → AlertDialog → justificativa
  → set_audit_justificativa (GUC) → update_atendimento_tx
  → trigger marca pos_finalizacao=true
```

## S10. Sequência — migração tenant
```
Super Admin → Provisionar schema
  → Migrar dados → Migrar auth (preserva hash)
  → Migrar storage → Smoke test
  → (verde) Flip runtime_mode=isolated_db
  → Purge shared
```

## S11. Sequência — IA
```
Usuário → Assistente → LLM propõe Tool
  → Frontend gate needsApproval (se marcada)
  → Executa Tool com userClient (RLS)
  → ai_audit registra
```
