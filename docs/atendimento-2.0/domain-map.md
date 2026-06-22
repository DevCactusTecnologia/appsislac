# Atendimento 2.0 — Fase 1.2 — Mapa de Domínio

## Entidades centrais

```
                       ┌──────────────┐
                       │   Tenant     │
                       └──────┬───────┘
                              │ 1..N (RLS por current_tenant_id)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  Paciente    │      │   Convênio   │      │   Unidade    │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │ 1..N                │ 0..N               │ 1..N
       └──────────┬──────────┴────────────────────┘
                  ▼
          ┌────────────────┐                  ┌────────────────┐
          │  Atendimento   │◄─── solicita ────│  Especialista  │
          │  (cabeçalho)   │                  └────────────────┘
          └───────┬────────┘
                  │ 1..N
        ┌─────────┴───────────────────────────────┐
        ▼                                         ▼
┌────────────────────┐                    ┌──────────────────────┐
│ Atendimento_Exame  │                    │ Atendimento_Pagamento│
│ (linha do pedido)  │                    │ (financeiro aditivo) │
└────┬───────┬───────┘                    └──────────────────────┘
     │       │
     │       │ snapshot regulatório (metodologia, unidade)
     │       │ snapshot terceirizado (lab_apoio, tipo_processo)
     │       │
     ▼       ▼
┌──────────┐  ┌────────────────┐    ┌────────────────────┐
│ Amostra  │  │  Catálogo      │    │ Lab Apoio + Jobs   │
│ (tubo)   │  │  exames_catalogo│    │ (integration_*)    │
└────┬─────┘  └────────────────┘    └────────────────────┘
     │
     ▼
┌──────────┐    ┌──────────────────┐
│ Recoleta │    │ Críticos comunic.│
└──────────┘    └──────────────────┘

Resultado / Liberação / Entrega:
Atendimento_Exame ── resultados (jsonb) ── Layout/Parâmetros ── VR ── Laudo ── Entrega
                                                                       └─ Identidade
                                                                       └─ Orientações
```

## Entidades e responsabilidades

### Atendimento
- Cabeçalho do pedido. Identificado por `protocolo` (sequencial atômico via `protocolo_sequence` + `protocolo_auditoria`, protegido por `protect_atendimento_protocolo`).
- Snapshot do paciente (nome, CPF, nascimento) **denormalizado** para impressão estável.
- `status_atendimento` e `status_pagamento` são **derivados** por trigger — nunca escritos direto pelo cliente.

### Atendimento_Exame
- Linha por exame solicitado. Status próprio: `pendente | coletado | em_bancada | em_analise | analisado | finalizado | cancelado`.
- Carrega:
  - **resultados** (`jsonb`) — payload livre alimentado pelo Layout Científico.
  - **datas** de coleta, análise, liberação.
  - **snapshot regulatório** (`metodologia_snapshot`, `unidade_snapshot`) congelado por trigger ao salvar/finalizar.
  - **terceirização**: `tipo_processo`, `lab_apoio_id`, `status_externo`, `protocolo_externo`, `pdf_override_*`.
  - **retificação**: `retificado`, `retificado_at`.

### Paciente / Convênio / Unidade / Especialista
- `pacientes.cpf` único por tenant.
- `convenios` carregam `tabela_id` (CBHPM/TUSS/Própria) — preço resolvido em cascata (`pricing.ts`).
- `unidades` com tipo (Sede/Filial/Ponto) — fluxo restrito.

### Amostra
- Código alfanumérico com DV (`gerar_codigo_amostra` + `_calc_dv_amostra`).
- Sequenciada por ano (`amostra_sequence`).
- Vínculo lógico ao exame pelo material/grupo.

### Recoleta
- Registrada com motivo (`recoletas_motivos`, sistema + tenant).
- Ligada ao exame; abre nova amostra quando atendida.

### Críticos / Identidade / Orientações / Entrega
- Compõem a trilha de **rastreabilidade RDC 786/2023**.
- Independentes entre si, sempre com FK para `atendimento_exames` ou `atendimentos`.

### Catálogo de exames
- `exames_catalogo` (69 colunas) carrega regras clínicas, layout default, integração e terceirização default.
- `exame_layouts` / `exame_parametros` / `exame_pops` / `valores_referencia` complementam o exame.

### Mapas / Produção
- `mapas_trabalho` agrupa exames de uma bancada/data.
- `producaoMetricsStore` agrega métricas — leitura, sem persistência própria.

## Relacionamentos críticos
- `atendimento_exames.atendimento_id → atendimentos.id` (cascata operacional via trigger `recompute_atendimento_status`).
- `atendimento_pagamentos.atendimento_id → atendimentos.id` (recalcula `status_pagamento`).
- `recoletas.atendimento_exame_id → atendimento_exames.id`.
- `criticos_comunicacoes.atendimento_exame_id`, `resultados_entregas.atendimento_id`, `identidade_confirmacoes.atendimento_id`, `orientacoes_entregues.atendimento_id`.
- `amostras` ↔ `atendimento_exames` por **material + atendimento + sequência** (não há FK forte hoje — ver SSOT report).

## Fronteiras de domínio
- **Atendimento** dirige Coleta → Análise → Liberação → Entrega.
- **Financeiro 2.0** consome via `atendimento_pagamentos`.
- **Convênios 2.0** consome via `convenio_fatura_itens` (FK lógico para `atendimento_exames`).
- **Integração** consome via `integration_jobs.atendimento_exame_id`.

— FIM —
