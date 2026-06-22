# Atendimento 2.0 — Fase 1.5 — SSOT Operacional

> Para cada estado: **fonte oficial**, **classificação** (SSOT / Duplicado / Parcial / Legado) e onde a verdade é projetada.

## Mapa SSOT

| Estado | Fonte oficial (SSOT) | Classificação | Projeções / Consumidores |
|---|---|---|---|
| **Status do atendimento** | `atendimentos.status_atendimento` (derivada por trigger `recompute_atendimento_status`) | ✅ SSOT | `atendimentoStatus.ts` (mapa visual), `atendimentos_page`, `atendimentos_kpis`, Dashboard, Resultados |
| **Status do exame** | `atendimento_exames.status` (escrita controlada por `update_atendimento_exame_tx` + RBAC trigger) | ✅ SSOT | RegistrarColeta, AnalisarAmostra, ResultadoDetalhe, Mapa |
| **Status da coleta** | `atendimento_exames.status` (`coletado`) + `atendimento_exames.data_coleta` + `amostras` | ⚠ Parcial | A coleta como **estado próprio** não existe — é derivada do status do exame e da existência da amostra |
| **Status da produção / bancada** | `atendimento_exames.status` (`em_bancada`/`em_analise`/`analisado`) | ⚠ Parcial | `producaoMetricsStore` deriva agregados; não há tabela de bancada própria |
| **Status da liberação** | `atendimento_exames.status='finalizado'` + `data_liberacao` + `atendimentos.status_atendimento='Resultado Liberado'` | ✅ SSOT (composto) | ResultadoDetalhe, ConsultarResultados |
| **Status da entrega** | `resultados_entregas` (linha = entrega) + `identidade_confirmacoes` + `orientacoes_entregues` | ✅ SSOT | rastreabilidadeStore, dossiê |
| **Status do pagamento** | `atendimentos.status_pagamento` (derivada por `recompute_status_on_pagamento` lendo `atendimento_pagamentos` + `financeiro_estornos`) | ✅ SSOT | Painel financeiro 2.0, A Receber v2 |
| **Status do terceirizado** | `atendimento_exames.status_externo` + `integration_jobs.status` | ⚠ Duplicado lógico | `status_externo` é snapshot do estado mais recente do job; ambos coexistem por rastreabilidade |
| **Protocolo** | `atendimentos.protocolo` + `protocolo_sequence` + `protocolo_auditoria` | ✅ SSOT | RPC `atendimento_assign_protocolo` é a única origem |
| **Snapshot regulatório (metodologia/unidade)** | `atendimento_exames.metodologia_snapshot` / `unidade_snapshot` (congelados por trigger) | ✅ SSOT | Laudo, ImpressaoGeral |
| **Identidade do paciente no laudo** | `atendimentos.paciente_nome / cpf / nascimento` (denormalizados) | ✅ SSOT (intencional) | Laudo, comprovantes |
| **Catálogo de exames (clínico)** | `exames_catalogo` | ✅ SSOT | Snapshot copiado para `atendimento_exames` na criação |
| **Layout científico** | `exame_layouts` | ✅ SSOT | Frozen no momento da liberação (não no INSERT do exame) |
| **Valores de referência** | `valores_referencia` | ✅ SSOT | Resolvido por sexo/idade no runtime do laudo |

## Pontos de atenção (não-SSOT identificados)

### 1. Coleta como entidade
- Não existe tabela `coletas`. A coleta é um efeito colateral de `update_atendimento_exame_tx` (status=coletado) + criação de `amostras`.
- **Risco**: rastreabilidade de "quem coletou, quando, qual tubo" depende de cruzar `atendimento_audit` + `amostras`. Suficiente hoje, mas frágil para indicadores granulares.

### 2. Produção como entidade
- Não existe `producao_lotes` ou `bancada_sessao`. `mapas_trabalho` agrupa logicamente, mas não carrega estado.
- `producaoMetricsStore` lê e agrega — não persiste.

### 3. Status externo terceirizado
- `atendimento_exames.status_externo` é **denormalizado** a partir do último `integration_jobs`.
- Risco baixo (atualizado por edge functions), mas formalmente é uma duplicação controlada.

### 4. Status agregado em vários níveis visuais
- O mapa de cores/ícones (`STATUS_ATENDIMENTO_TYPES`) está em `src/lib/atendimentoStatus.ts` — único.
- Histórico: havia mapas paralelos em componentes; foram consolidados (ver memória `domain/status-padronizados-flat`).

## Veredito SSOT
- Status de atendimento, exame, liberação, pagamento, protocolo, snapshots regulatórios e entrega têm **SSOT clara**.
- "Coleta" e "Produção" como entidades **não têm SSOT explícita** — são derivadas. Fase 2 deve decidir: formalizar ou manter derivação.
- Nenhum estado crítico é gravado pelo cliente sem passar por trigger ou RPC.

— FIM —
