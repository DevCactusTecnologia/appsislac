# WhatsApp 2.0 — Fase 3A | Plano de Implementação Enxuta

Antes de executar, preciso da sua confirmação explícita — esta fase mexe em banco, edge functions, todos os produtores de WhatsApp e remove código legado (mudança estrutural).

---

## 1. Banco (1 migration única)

Criar:

- **`whatsapp_outbox`** — fila única
  - `id, tenant_id, paciente_id, telefone, template_nome, template_versao, idioma, variaveis jsonb, botoes jsonb, prioridade, status (pending|sending|sent|failed|failed_permanent|opted_out|rate_limited), tentativa, max_tentativas, proxima_tentativa_em, idempotency_key UNIQUE, message_id, erro, criado_por, criado_em, atualizado_em`
- **`whatsapp_opt_out`**
  - `id, tenant_id (NULL=global), paciente_id, telefone, motivo, origem, criado_em` — chave de busca prioritária: `paciente_id`; `telefone` é fallback
- **`whatsapp_metrics_tenant`**
  - `tenant_id, dia, enviados, entregues, lidos, falhas, opt_outs, PRIMARY KEY(tenant_id,dia)`
- **`whatsapp_templates_cache`** — somente leitura, populada pelo sync (Meta = SSOT)
  - `nome, idioma, versao, categoria, status, corpo, botoes jsonb, sincronizado_em`
- **`tenant_rate_limit`**
  - `tenant_id, mensagens_por_hora, mensagens_por_dia, bloqueado_ate`
- Função `enqueue_whatsapp(...)` SECURITY DEFINER (valida opt-out + rate limit + insere outbox)
- RLS + GRANTs em todas; somente Super Admin vê tudo, tenant vê o seu próprio
- `tenant_whatsapp_config`: campo `modo` ganha valor `centralized` (sem migrar tenants ainda)

## 2. Edge functions

- **`whatsapp-dispatcher`** (novo) — invocado **imediatamente** após `enqueue` (dispatcher imediato); também roda via cron a cada 1 min só para retry/falhas. Lê N itens com `FOR UPDATE SKIP LOCKED`, checa opt-out + rate limit, chama Meta Graph API com credenciais do Vault, grava `whatsapp_mensagens` + atualiza outbox + métricas.
- **`whatsapp-template-sync`** (novo) — cron diário; lê templates aprovados na Meta e atualiza `whatsapp_templates_cache`. Sem CRUD manual.
- **`whatsapp-webhook`** (estender) — captura `STOP/SAIR/CANCELAR` → insere opt-out global; processa `delivered/read/failed` ligando por `message_id`.
- **`whatsapp-send`** (manter, marcar deprecated) — continua atendendo tenants `simples/cloud_api/zapi` durante migração.

Secrets novos (via add_secret): `WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_VERIFY_TOKEN`, `WHATSAPP_META_APP_SECRET`.

## 3. Produtores → `enqueueNotification()`

Novo helper `src/lib/whatsapp/enqueueNotification.ts`:

```ts
enqueueNotification({ tenantId, pacienteId, telefone, template, variaveis })
```

Internamente: chama RPC `enqueue_whatsapp` + dispara `whatsapp-dispatcher` (fire-and-forget).

Migrar chamadas em:

- `atendimentoStore.finalizar` → `sislac_comprovante_atendimento`
- agenda/agendamento confirmado → `sislac_comprovante_agendamento`
- `ResultadoDetalhe` liberação → `sislac_resultados_prontos`
- `orcamentoStore.criar` → `sislac_orcamento`
- `recoletasStore.criar` → `sislac_recoleta`
- clínica (quando existir) → `sislac_consulta_confirmacao`, `sislac_orcamento_clinica`
- `leads-manager` (OTP) → `sislac_otp_cadastro` (primeira prova de fogo)

Botão "Enviar comprovante" da UI: muda de `wa.me/whatsapp-send` para `enqueueNotification`. Modo Simples (`wa.me`) só permanece para tenants ainda não migrados.

## 4. Central de Notificações (Super Admin)

Nova rota `/super-admin/notificacoes` exibindo:

- KPIs: envios/dia, entregues, lidos, falhas, opt-outs
- Tabela outbox com filtros (tenant, status, template, período)
- Ações: reprocessar item, ver payload, cancelar
- Lista de templates do cache (somente leitura) + status Meta
- Lista de opt-outs

Sem editor de campanha, sem chatbot, sem IA, sem disparo em massa.

## 5. Limpeza de legado

Critério estrito: **0 imports, 0 referências, 0 consumidores**.

Auditar e remover (somente o que bater o critério):

- helpers/stores/componentes WhatsApp órfãos
- código de provider abandonado se sem uso real
- `simples/cloud_api/zapi` **mantidos** (há tenants ativos) — apenas marcados `@deprecated` no JSDoc

## 6. Validação

- `bun run build`
- `bunx vitest run`
- Smoke: cada um dos 7 fluxos (Comprovante Atendimento, Comprovante Agendamento, Resultados, Orçamento, Recoleta, Consulta, OTP) deve entrar na outbox, ser despachado, receber status e gerar auditoria.

## 7. Relatório final

`docs/whatsapp-2.0/phase3a-report.md` respondendo todas as perguntas da missão.

---

## Confirmação necessária

Você confirma:

1. Criar as 5 tabelas novas + função `enqueue_whatsapp` (migration única)?
2. Criar `whatsapp-dispatcher` e `whatsapp-template-sync`, estender `whatsapp-webhook`?
3. Migrar todos os 7 produtores listados para `enqueueNotification()` neste turno?
4. Criar rota Super Admin `/super-admin/notificacoes`?
5. Solicitar via `add_secret` as 4 credenciais Meta corporativas (você precisará colá-las)?

Se sim a tudo, executo a Fase 3A inteira nas próximas mensagens. Se quiser fatiar (ex.: só infra + OTP primeiro, demais produtores depois), me diga.
