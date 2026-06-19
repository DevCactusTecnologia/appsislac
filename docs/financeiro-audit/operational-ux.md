# Experiência Operacional — Financeiro

Mapeamento por perfil, com base em `usuariosStore.ts` e nas telas atuais.

## Recepção
- Telas: `/atendimentos` (cria/edita), `/registrar-coleta`, `/orcamentos`.
- Ações financeiras possíveis: `PagamentoDialog` (registrar pagamento avulso de paciente), aplicar desconto (redistribuído nos exames).
- Não acessa `/financeiro` (sem `visualizar_financeiro` por padrão).
- Informa: quanto o paciente já pagou; quanto falta (status_pagamento).

## Financeiro (perfil "financeiro" / setor)
- Telas: `/financeiro` (todas as abas), `/convenios` (faturamento), `/atendimentos` (registrar pagamento posterior).
- Ações:
  - Entradas: ver receita realizada, imprimir, filtrar por convênio/período.
  - A Receber: localizar inadimplentes, abrir detalhe, registrar pagamento.
  - Saídas: criar despesa, marcar como paga, editar (sem excluir).
  - Caixa: imprimir Livro-Caixa do dia/período.
  - Faturas: fechar fatura de convênio, marcar paga, cancelar.
  - Dicionários: criar/desativar tipos de despesa, destinos, formas de pagamento.

## Gestor (manager)
- Mesma superfície de "financeiro" + acesso a Auditoria, Dashboard com KPIs.
- Decisões: aprovar descontos atípicos (não há fluxo formal — depende de comunicação fora do sistema).

## Contador (perfil sugerido — não existe role dedicada)
- Hoje usa o role **financeiro** ou **manager**.
- Necessidades atendidas: imprimir Livro-Caixa, exportar (botão de impressão), ver saídas com tipo_despesa.
- Necessidades NÃO atendidas: plano de contas, conciliação bancária, exportação para sistemas contábeis (SPED, OFX, CSV padrão), regime de competência separado de regime de caixa.

## Admin
- Tudo do gestor + DELETE em saídas/faturas/pagamentos + cadastro de convênio.

## Super Admin (plataforma)
- Vê dados via `is_super_admin()` mas opera fora do tenant; não usa o financeiro do tenant no dia-a-dia.
- Edge functions `super-admin-billing` etc. tratam **assinatura SaaS**, não financeiro do laboratório.

## Pontos de fricção observados (somente documentação, sem julgamento de mérito)

1. **Nova entrada manual** chama o mesmo `NovaEntradaSaidaDialog` usado para saídas — o usuário precisa entender o contexto da aba.
2. **Forma de pagamento da saída** não é exibida em coluna — vem decodificada de `[pgto:...]` na descrição.
3. **Caixa não tem operador**: qualquer um com permissão imprime o livro-caixa do dia, sem rastrear quem "responde" pelo dinheiro.
4. **A Receber convênios** depende do usuário lembrar de fechar fatura — nada é automatizado por `prazo_faturamento_dias`.
5. **Estorno de pagamento** = exclusão (apenas admin), sem motivo formal.
6. **Glosa** não tem fluxo: o usuário cancela e refatura ou reduz manualmente o desconto antes de marcar paga.
