# Atendimento 2.0 — Fase 1.10 — Relatório Executivo

> Síntese das fases 1.1 → 1.9. Modo: somente leitura.

## Como um exame nasce?
1. Recepção abre `NovoAtendimento.tsx`.
2. Cliente seleciona paciente + solicitante + convênio + unidade + lista de exames + pagamentos.
3. Submissão chama edge `create-atendimento` → RPC transacional `create_atendimento_tx`.
4. RPC insere `atendimentos`, gera protocolo (sequenciador atômico), insere `atendimento_exames` (status `pendente`) e `atendimento_pagamentos`.
5. Triggers congelam snapshot regulatório e terceirizado, recalculam status agregado e totais, escrevem auditoria.

## Como um exame caminha?
- Coleta (`registrar_coleta`) → `coletado` + `amostras`.
- Bancada (`analisar_amostra`) → `em_bancada` → `em_analise` → `analisado`.
- Liberação (`liberar_resultado`) → `finalizado` + `data_liberacao` → status agregado vai a "Resultado Liberado".
- Entrega → `resultados_entregas` + `identidade_confirmacoes` + `orientacoes_entregues`.
- Retificação (após liberação) → reabre com `retificado=true` + justificativa → "Em Retificação" → "Retificado".

## Como um exame termina?
- **Positivo**: `Resultado Liberado` + entrega registrada.
- **Negativo**: `Cancelado` / `Pedido cancelado` (motivo do catálogo + auditoria).
- Em qualquer caminho terminal: pagamentos exigem **estorno formal** (DELETE bloqueado).

## Quem altera?
- Recepção: cria/edita atendimento.
- Coleta: muda status de exame para `coletado`, gera amostras.
- Biomédico/analista: bancada e análise.
- Biomédico/admin: liberação e retificação.
- Admin: cancelamento, ajustes pós-finalização (com justificativa).
- **Toda mutação passa por RBAC** revalidado em três camadas: edge function, RLS policy, trigger BEFORE UPDATE.

## Existe SSOT operacional?
**Sim**, para os estados core:
- `atendimentos.status_atendimento`, `status_pagamento` (derivados por trigger).
- `atendimento_exames.status`.
- `atendimento_exames.data_liberacao` + status agregado = liberação.
- `resultados_entregas` = entrega.
- `protocolo` único e protegido.
- Snapshots regulatório/terceirizado congelados.

**Parcial** para:
- "Coleta" como entidade — derivada de status + amostra.
- "Produção" como entidade — agregada em runtime.

## Existe duplicação?
- Nenhuma duplicação crítica não-intencional.
- Coexistências intencionais: `status_externo` × `integration_jobs` (rastreabilidade), `lab-apoio-adapter` × `integration-*` (transição arquitetural).

## Existem status paralelos?
- Não. `atendimentoStatus.ts` é o único mapa visual ativo (consolidado em fase anterior).

## Existem gargalos?
- Telas gigantes: `NovoAtendimento.tsx` (2801) e `ResultadoDetalhe.tsx` (2648).
- KPIs de produção em runtime (sem materialização).
- Liberação com layout grande re-renderiza a cada digitação.
- Coleta sem ações em lote por padrão.

## Existem regras espalhadas?
- Núcleo está em RPCs e triggers (banco). **Bom**.
- Frontend ainda concentra muita orquestração em `NovoAtendimento` e `ResultadoDetalhe` (justificável; orquestração ≠ regra).
- Política de janela de edição: sincronizada via `app_settings.edit_window_hours` + `atendimentoPolicy.ts`. Coerente.

## Existe código legado?
- Sem fluxos abandonados claros.
- Componentes grandes (NovoAtendimento, ResultadoDetalhe) são candidatos a split — não legado.
- Convergência futura entre `lab-apoio-*` e `integration-*` listada como oportunidade.

## Maior problema operacional atual
> **Concentração de orquestração em duas páginas gigantes (`NovoAtendimento` e `ResultadoDetalhe`)**, somada à ausência de SSOT explícita para "Coleta" e "Produção" como entidades — o que dificulta análises granulares e manutenção evolutiva, embora não comprometa segurança nem rastreabilidade.

## Prioridade da Fase 2 (sugestão para embasar — não decisão)
1. **Split arquitetural** de `NovoAtendimento` e `ResultadoDetalhe` em sub-rotas/painéis.
2. **Formalizar Coleta** como entidade auditável (tabela `coletas` ou view materializada).
3. **Materializar Produção** (KPIs por dia/responsável/setor).
4. **Convergência de terceirização** para o caminho `integration-*` (jobs).
5. **Otimização do laudo** (deferred render + snapshot).

## Veredito
- **Núcleo operacional sólido**: SSOT clara nos estados críticos, RBAC em três camadas, triggers blindando integridade, auditoria completa.
- **Risco operacional remanescente**: complexidade de UI em duas telas + observabilidade granular de coleta/produção.
- **Pronto para Fase 2** com base sólida — sem dívidas de segurança ou consistência.

— FIM —
