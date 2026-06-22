# Soroteca 2.0 — Fase 6 — Empréstimos

## Objetivo
Eliminar o gap apontado na auditoria (`loan-audit.md`): controle real de retirada física de amostras com **fluxo de solicitação → aprovação → retirada → devolução**, auditável e bloqueando reutilização indevida.

## Modelo de dados

Tabela nova `public.amostra_emprestimos` (multi-tenant, RLS):

| Coluna | Papel |
|---|---|
| `status` (enum `emprestimo_amostra_status`) | `PENDENTE` → `APROVADO` → `RETIRADO` → `DEVOLVIDO`; alt: `REJEITADO`, `CANCELADO` |
| `solicitante_*`, `solicitado_em` | Quem abriu, quando |
| `destinatario_nome`, `motivo`, `prazo_devolucao`, `observacao_solicitacao` | Conteúdo do pedido |
| `aprovador_*`, `decidido_em`, `motivo_rejeicao` | Aprovação ou rejeição |
| `retirado_*`, `retirado_em` | Retirada física |
| `devolvido_*`, `devolvido_em`, `observacao_devolucao` | Devolução |
| `cancelado_em`, `motivo_cancelamento` | Cancelamento |

Garantia chave:

```sql
CREATE UNIQUE INDEX uniq_emprestimo_amostra_ativo
  ON amostra_emprestimos (amostra_id)
  WHERE status IN ('PENDENTE','APROVADO','RETIRADO');
```

→ **No máximo 1 empréstimo ativo por amostra**. Violação retorna 23505 (tratado no store com mensagem amigável).

### Função utilitária
`amostra_em_emprestimo_ativo(amostra_id)` — SECURITY DEFINER, executável só por `authenticated` e `service_role`.

### RLS
- `SELECT`: qualquer usuário do tenant (visibilidade compartilhada).
- `INSERT/UPDATE`: exige `has_permission(uid, 'armazenar_amostra')`.
- `DELETE`: só super admin (preserva auditoria).

## Store (`src/data/sorotecaEmprestimosStore.ts`)
Operações idempotentes com guards de status:
- `solicitarEmprestimo` — valida amostra existe e ≠ `DESCARTADA`; resolve `tenant_id` da própria amostra.
- `aprovarEmprestimo` / `rejeitarEmprestimo` — só transitam de `PENDENTE`.
- `registrarRetirada` — só transita de `APROVADO`.
- `registrarDevolucao` — só transita de `RETIRADO`.
- `cancelarEmprestimo` — válido em `PENDENTE` ou `APROVADO`.
- Consultas: `listarEmprestimos`, `getEmprestimoAtivoPorAmostra`, `contarEmprestimosVencidos`.
- Helpers visuais: `emprestimoStatusLabel`, `emprestimoStatusBadge`, `emprestimoVencido`.

Cada mutação preenche os campos de identidade (usuário + nome) a partir da sessão.

## Bloqueio de reutilização
`buscarAmostrasReutilizaveis` (`sorotecaStore.ts`) agora consulta `amostra_emprestimos` por `amostra_id IN (...)` com status ativos e remove as bloqueadas do resultado. Amostra emprestada não aparece como candidata para outro exame, eliminando o risco apontado no audit.

## UI (`src/pages/SorotecaEmprestimos.tsx`) — `/soroteca/emprestimos`
- Cabeçalho com botão **Novo empréstimo**.
- Abas: Ativos · Pendentes · Aprovados · Retirados · Devolvidos · Rejeitados · Cancelados · Todos.
- Busca por destinatário, solicitante ou motivo (debounce 300 ms).
- Cards de empréstimo com badge flat de status, indicador **Prazo vencido**, ações contextuais por status (Aprovar/Rejeitar/Retirar/Devolver/Cancelar).
- Diálogo de Novo empréstimo: bipa código → resolve amostra → preenche destinatário/motivo/prazo/observação → grava `PENDENTE`.
- Diálogos compactos pedem o motivo nas ações destrutivas (rejeição/cancelamento) e tornam-no opcional na devolução.

Permissão de acesso à rota: `registrar_coleta` (consistente com `/soroteca/triagem` e `/soroteca/materiais`); RLS no banco gate-keepa o INSERT/UPDATE.

## Regressões verificadas
- Nenhuma alteração na tabela `amostras` (sem novo enum status).
- `listarAmostras`, `buscarAmostrasAvancado` e o fluxo de Atendimento/Coleta/Produção não foram tocados.
- O scanner HID continua isolado em `Soroteca.tsx`; o diálogo de novo empréstimo abre seu próprio campo focado.
- Migration aprovada com zero novos avisos do linter (a função SECURITY DEFINER já entrou com `EXECUTE` restrito).

## Critérios de aceite (audit → status)
| Pergunta original | Status |
|---|---|
| Existe entidade própria de empréstimo? | ✅ |
| Registra responsável + motivo + prazo + devolução? | ✅ |
| Bloqueia reuso enquanto emprestada? | ✅ |
| Alerta de prazo vencido? | ✅ visual no card |
| Histórico auditável? | ✅ todos os campos preservados + DELETE bloqueado |

## Próximas fases (não fazer agora)
- **Fase 7 — Expurgo programado**: usa `materiais_amostra.dias_retencao` (Fase 4) para gerar lote candidato.
- **Fase 8 — Timeline real**: integrar empréstimos no `AmostraDetalheDialog`.
- Notificação WhatsApp opcional para o solicitante quando aprovado/rejeitado (reutilizar pipeline `enqueueNotification`).

**PARADA.** Aguardando aprovação explícita para iniciar a **Fase 7 — Expurgo Programado**.
