# Convênios 2.0 — UX Operacional

## Por perfil

### Recepção
- Não fatura. Apenas registra `cobranca_destino='convenio'` no atendimento.
- Pontos de atrito:
  - Se o convênio escolhido não tiver preço cadastrado, o exame entra com R$ 0 (fallback `getPrecoExame`). Isso só é detectado depois, no faturamento.
  - Não há aviso na recepção sobre "convênio em atraso" ou "limite de exames excedido" — esses conceitos não existem.

### Faturamento (perfil `gestao_financeira`)
- Tela única: `/financeiro` ▶ aba **Convênios**.
- Sub-tabs: **Em aberto** (saldo por convênio) e **Faturas** (histórico).
- Atritos reais:
  - **Sem ver os itens antes de abrir o dialog**: a lista "Em aberto" mostra só saldo agregado por convênio. Para ver paciente/exame, precisa abrir `FecharFaturaDialog`.
  - **Sem filtro por competência**: filtragem é apenas por status na sub-tab Faturas.
  - **Sem busca por código de fatura ou convênio**: lista corre na unha.
  - **Sem ação em massa**: cada convênio é fechado individualmente.
  - **Sem export**: não dá para baixar CSV/Excel de itens faturados.
  - **Sem reabrir fatura**: fatura cancelada sai do histórico operacional (mas continua no banco). Refazer = começar do zero.
  - **Sem editar fatura aberta**: para alterar desconto após criar, precisa cancelar e refazer.
  - **Recebimento parcial**: impossível. Convênio paga 70%? Operador tem que cancelar e refazer com desconto manual de 30% — perdendo a fatura original como evidência.

### Financeiro (perfil `visualizar_financeiro`)
- Pode ler tudo. Não pode mexer em fatura.
- Atritos:
  - Não há painel separado mostrando "fluxo de caixa previsto por convênio" — `dias_retorno`/`prazo_faturamento_dias` estão lá mas ninguém usa para projeção.
  - Recebimentos de fatura aparecem **misturados** com pagamentos avulsos no livro caixa, diferenciados apenas pelo campo `origem` (que nem todas as colunas exibem).

### Gestor / Admin
- Cadastra convênios em `/configuracoes` e `/convenios`.
- Atritos:
  - Duas portas para mesma coisa: `/convenios` (página dedicada) e `/configuracoes` ▶ aba Convênios renderizam o **mesmo componente**.
  - Painel de cobertura de preço (`ConvenioExamesPanel`) é denso (539 linhas) e não tem busca por exame não-precificado.
  - Sem relatório de glosa por convênio (porque não existe glosa).
  - Sem indicador "tempo médio de recebimento" — `dias_retorno` é nominal, não medido.

### Super Admin
- Vê tudo cross-tenant. Sem UI dedicada para convênios — apenas via `super-admin-tenant-snapshot`.

## Retrabalho concreto detectado

1. **Glosa manual**: cancelar → recriar com desconto. Perde-se rastro do valor original.
2. **Reapresentação**: idem. Não há "fatura v2" da mesma competência.
3. **Conferência caixa vs fatura**: se a recepção recebe PIX/Dinheiro do convênio, ele não bate com Caixa Operacional. Operador concilia manualmente.
4. **Verificar pendência por exame**: precisa abrir o dialog para ver. Não há listagem direta de exames a faturar.
5. **Atualizar tabela de preço**: quando muda CBHPM/TUSS, exames já lançados ficam com valor antigo (snapshot). Sem alerta.

## Complexidade desnecessária

1. Página `/convenios` é wrapper trivial de `ConveniosTab` de Configurações — fragmenta navegação.
2. `fetchSaldoEmAbertoPorConvenio` ainda exportado e exibe a mesma informação que o SSOT — induz ao erro em telas novas.
3. Forma de pagamento na fatura é `text` livre (com default `'Faturado'` na view) — sem alinhamento com `select_options` financeiro.

## Faltas de UX (não há nada hoje)

- Indicador de prazo de fatura (vencendo / atrasada).
- Aging por convênio (0-30, 31-60, 60+).
- Drill-down "qual paciente/exame contribui para o saldo?" sem abrir dialog modal.
- Impressão / exportação da fatura.
- Histórico por convênio (faturas + pagamentos cronológicos).
