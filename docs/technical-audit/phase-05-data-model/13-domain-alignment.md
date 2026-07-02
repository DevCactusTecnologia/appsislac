# 13 — Domain Alignment

Cruzamento entre o mapa do domínio (fase 03) e o modelo persistido.

## Correspondência 1:1 (domínio → tabela)

| Conceito de domínio | Tabela |
|---|---|
| Paciente | `pacientes` |
| Médico solicitante | `especialistas` |
| Convênio | `convenios` |
| Unidade / filial | `unidades` |
| Ordem de serviço | `atendimentos` |
| Exame do OS | `atendimento_exames` |
| Pagamento | `atendimento_pagamentos` |
| Orçamento | `orcamentos` + `orcamento_exames` |
| Amostra biológica | `amostras` |
| Movimentação da amostra | `amostra_movimentacoes` |
| Empréstimo entre unidades | `amostra_emprestimos` |
| Expurgo (RDC 302) | `expurgo_lotes` + `expurgo_itens` |
| Recoleta | `recoletas` |
| Transporte | `transporte_remessas` |
| Valor crítico | `criticos_comunicacoes` |
| Confirmação identidade (LGPD) | `identidade_confirmacoes` |
| Orientação pré-analítica | `orientacoes_entregues` |
| Entrega de laudo | `resultados_entregas` |
| Catálogo de exame | `exames_catalogo` |
| Parâmetro de exame | `exame_parametros` |
| Valor de referência | `valores_referencia` + `reguas_etarias` |
| Layout de laudo | `exame_layouts` |
| POP | `exame_pops` |
| Template de documento | `documento_templates` |
| Caixa | `caixa_sessoes` |
| Despesa | `financeiro_saidas` |
| Estorno | `financeiro_estornos` |
| Competência / fatura convênio | `convenio_competencias` / `convenio_faturas` / `convenio_fatura_itens` / `convenio_glosas` |
| Insumo | `estoque_insumos` / `estoque_lotes` / `estoque_movimentacoes` |
| Mapa de trabalho | `mapas_trabalho` / `mapa_exames` |
| Lab de apoio | `labs_apoio` + `integrations` + `integration_*` |
| WhatsApp | `whatsapp_*` |
| Tenant | `tenants` + `tenant_*` |
| Perfil | `profiles` |
| Papel | `user_roles` |
| Auditoria | `*_audit`, `audit_logs`, `operational_audit`, `platform_audit` |

## Cobertura do domínio
- **100% dos 20 macroprocessos** identificados na Fase 03 têm representação persistente.
- **100% das ~30 máquinas de estado** têm colunas de status + trilha (via `*_audit` ou tabela histórica dedicada).
- **60+ eventos de domínio** (Fase 03) são materializados pelas RPCs `*_tx` + triggers `audit_*`.

## Alinhamento entre camadas
| Camada | Papel | Alinhamento com modelo |
|---|---|---|
| UI/store (`src/data/*Store.ts`) | ~1 store por entidade | Aderente |
| Edge Functions | Ações compostas | Chamam RPCs `*_tx` — sem duplicar regra |
| RPCs `*_tx` | Regras de negócio | Fonte única da verdade |
| Triggers | Auditoria e enforcement | Não competem com RPCs |
| RLS | Isolamento | Coerente com `tenant_id` universal |

## Responsabilidades bem distribuídas
- **Frontend**: apresenta e coleta; não decide preço, status nem transição.
- **RPC**: decide transições, calcula, valida e escreve com trilha.
- **Trigger**: auditoria automática e updated_at.
- **RLS**: isolamento — nunca é usada como regra de negócio.
- **Edge Function**: bridge para o mundo externo (webhooks, storage, IA, PDF).

## Onde o alinhamento é apenas parcial
1. **Valores de Referência**: `exame_parametros.valor_referencia` (texto livre) coexiste com `valores_referencia.descricao` estruturado. Frontend precisa decidir qual usar caso a caso — o modelo permite ambiguidade. (Documentado em `docs/valores-referencia-2.0/`.)
2. **Tipagem fraca em VR**: `sexo`, `unidade_idade`, `valor_min/max` como `text` sem CHECK.
3. **Dicionários redundantes**: `financeiro_formas_pagamento` (tenant) + `select_options` categoria "forma_pagamento" (global) coexistem.
4. **Colunas de UI legadas em `exame_parametros`**: `exibir_anterior`, `exibir_mapa`, `visivel` — presença no schema sem consumo consistente.

Nenhum desses pontos rompe o alinhamento — todos são **áreas de flexibilidade documentada**.

## Veredito de alinhamento
O modelo de dados representa **fielmente** o domínio do laboratório clínico. A estrutura relacional espelha os conceitos operacionais reais e a lógica está concentrada em RPCs identificáveis. As áreas de flexibilidade são conhecidas, documentadas e limitadas ao catálogo.
