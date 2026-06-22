# Atendimento 2.0 — Fase 1.3 — Jornada Completa do Exame

## Macro-fluxo

```
Paciente
   │
   ▼
Recepção (NovoAtendimento.tsx)
   │  cria atendimento + linhas de exame + pagamentos iniciais
   ▼
create-atendimento (edge) → create_atendimento_tx (RPC)
   │
   ▼
Atendimento criado (status_atendimento = "Pedido Realizado")
   │
   ├─ exames pendentes ─────► Coleta (RegistrarColeta.tsx)
   │                            │
   │                            ▼  amostras + códigos
   │                          status_exame = "coletado"  ⇒ "Amostra Coletada"
   │
   ├─ exames terceirizados ─► Roteamento (RoteamentoApoioPanel)
   │                            │
   │                            ▼  integration_jobs
   │                          status_externo: AGUARDANDO_ENVIO → ENVIADO → EM_ANALISE_LAB
   │                                                            → RESULTADO_RECEBIDO → IMPORTADO
   │
   ▼
Bancada / Triagem (Mapa.tsx, AnalisarAmostra.tsx)
   │
   ▼
Análise (ResultadoDetalhe.tsx)
   │  Layout Científico → resultados (jsonb) → VR resolvida → críticos
   │
   ▼  status_exame = "em_analise" → "analisado" → "finalizado"
   │
   ├─► Crítico detectado ─► RegistrarCriticoDialog → criticos_comunicacoes
   │
   ▼
Conferência / Liberação (ResultadoDetalhe — botão Liberar)
   │  exige: assinatura, layout congelado, snapshot regulatório
   ▼
status_atendimento = "Resultado Liberado"  (derivado)
   │
   ├─► Retificação posterior:
   │     status_exame ← "finalizado" (com retificado=true, retificado_at=now)
   │     status_atendimento → "Em Retificação" → "Retificado"
   │     justificativa obrigatória (set_audit_justificativa)
   │
   ▼
Entrega (RegistrarEntregaDialog) → resultados_entregas + identidade_confirmacoes + orientacoes_entregues
   │
   ▼
ConsultarResultados / LaudoPrintPage / ImpressaoGeral
```

## Estados canônicos

### `atendimentos.status_atendimento` (derivado)
Valores produzidos pelo trigger `recompute_atendimento_status` — espelhados em `src/lib/atendimentoStatus.ts`:
- `Pedido Realizado` (default)
- `Amostra Coletada`
- `Em Análise`
- `Amostra Analisada`
- `Resultado Salvo`
- `Em Retificação`
- `Retificado`
- `Resultado Liberado`  ← terminal positivo
- `Cancelado` / `Pedido cancelado`  ← terminal negativo

### `atendimentos.status_pagamento` (derivado)
- `Pagamento pendente | parcial | efetuado | cancelado`.

### `atendimento_exames.status` (operacional, escrita por RPC/RBAC)
- `pendente → coletado → em_bancada → em_analise → analisado → finalizado`
- + `cancelado` (terminal).

### `atendimento_exames.status_externo` (terceirizado)
- `NAO_APLICAVEL | AGUARDANDO_ENVIO | ENVIADO | EM_ANALISE_LAB | RESULTADO_RECEBIDO | IMPORTADO | FINALIZADO | ERRO_INTEGRACAO`.

## Eventos e quem os dispara
| Evento | Origem | Persistência |
|---|---|---|
| Criação atendimento | `NovoAtendimento.tsx` → edge `create-atendimento` | `create_atendimento_tx` (transacional) |
| Edição atendimento | `NovoAtendimento.tsx` (modo edit) → edge `update-atendimento` | `update_atendimento_tx` |
| Mudança de exame (status, resultados, datas) | `RegistrarColeta`, `AnalisarAmostra`, `ResultadoDetalhe` | RPC `update_atendimento_exame_tx` |
| Recoleta | `SolicitarRecoletaDialog` | `recoletasStore` → tabela `recoletas` |
| Crítico | `RegistrarCriticoDialog` | `rastreabilidadeStore` → `criticos_comunicacoes` |
| Liberação | `ResultadoDetalhe` (Liberar) | `update_atendimento_exame_tx` (status=finalizado, data_liberacao) |
| Retificação | `ResultadoDetalhe` (após liberar) | mesmo RPC com `retificado=true` + `set_audit_justificativa` |
| Entrega | `RegistrarEntregaDialog` | `resultados_entregas` + `identidade_confirmacoes` |
| Cancelamento | `AtendimentoDetalheDialog` / botão | `update_atendimento_tx` com status forçado |
| Pagamento | `PagamentoDialog` | INSERT em `atendimento_pagamentos` (DELETE bloqueado) |
| Estorno | `PagamentoDialog` | INSERT em `financeiro_estornos` |

## Snapshots e congelamentos (não regridem)
- `atendimento_exames.metodologia_snapshot` / `unidade_snapshot` — RDC 786 (trigger `atendimento_exames_snapshot_regulatorio`).
- `atendimento_exames.lab_apoio_id` / `tipo_processo` — terceirização (trigger `snapshot_exame_terceirizado` no INSERT).
- `atendimentos` — denormaliza nome/CPF/nascimento do paciente.
- Layout do laudo congelado por exame (frozen on liberação).

## Janela de edição
- Configurável em `app_settings.edit_window_hours` (default 24h).
- Após esse prazo, ou em estado terminal, qualquer mutação exige `set_audit_justificativa()` antes — verificada por `require_justificativa_pos_finalizacao`.

— FIM —
