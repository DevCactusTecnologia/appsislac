# WhatsApp 2.0 — Fase 3A | Relatório de Implementação

> Implementação enxuta da arquitetura corporativa centralizada Meta. Sem chatbot, sem CRM, sem campanhas. Apenas notificações oficiais.

---

## 1. Tabelas criadas

Todas em `public`, com RLS + GRANTs aplicados na mesma migration:

| Tabela | Propósito |
|---|---|
| `whatsapp_outbox` | Fila única. Toda intenção de envio é registrada aqui. Status: `pending`, `sending`, `sent`, `failed`, `failed_permanent`, `opted_out`, `rate_limited`, `cancelled`. Idempotência por `(tenant_id, idempotency_key)`. |
| `whatsapp_opt_out` | Pacientes/telefones que pediram para não receber. Escopo global (`tenant_id IS NULL`) ou por laboratório. Prioridade: `paciente_id`; `telefone` é fallback. |
| `whatsapp_metrics_tenant` | Métricas diárias por tenant (`enviados, entregues, lidos, falhas, opt_outs`). |
| `whatsapp_templates_cache` | Cache **somente leitura** dos templates aprovados na Meta. Meta = SSOT. Sem CRUD manual. |
| `tenant_rate_limit` | Limites `mensagens_por_hora` (default 250) e `mensagens_por_dia` (default 1000) + `bloqueado_ate` por tenant. |

**Enum:** `whatsapp_modo` ganhou valor `centralized` para preparar a migração progressiva. Nenhum tenant foi migrado nesta etapa.

**Função:** `public.enqueue_whatsapp(...)` SECURITY DEFINER com `search_path = public`. Valida opt-out (paciente ⟶ telefone), valida rate limit, normaliza telefone para E.164 brasileiro, garante idempotência e enfileira. EXECUTE revogado de PUBLIC; concedido a `authenticated` e `service_role`.

---

## 2. Edge functions criadas / alteradas

| Função | Tipo | Responsabilidade |
|---|---|---|
| `whatsapp-dispatcher` | nova | Lê outbox (pending / failed com `proxima_tentativa_em <= now()`), chama Meta Graph API com template + variáveis, grava `whatsapp_mensagens`, atualiza outbox e métricas. Backoff exponencial: 1, 5, 30, 120, 480 min. Erros permanentes Meta (token, template, formato) → `failed_permanent`. |
| `whatsapp-template-sync` | nova | Lê `/{WABA_ID}/message_templates` paginado e faz upsert em `whatsapp_templates_cache`. Único caminho para popular templates no SISLAC. |
| `whatsapp-webhook` | estendida | (a) Handshake aceita `WHATSAPP_META_VERIFY_TOKEN` central **e** tokens legados de `tenant_whatsapp_config`. (b) Status `delivered/read/failed` atualizam `whatsapp_outbox` e `whatsapp_metrics_tenant`. (c) Mensagens recebidas com palavras `STOP/SAIR/CANCELAR/PARAR/UNSUBSCRIBE` viram opt-out **global**. |
| `whatsapp-send` | mantida, `@deprecated` | Continua atendendo tenants em `simples/cloud_api/zapi`. Será removida quando todos migrarem para `centralized`. |

**Secrets adicionados** (via `add_secret`): `WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_VERIFY_TOKEN`, `WHATSAPP_META_APP_SECRET`, `WHATSAPP_META_BUSINESS_ACCOUNT_ID`.

---

## 3. Produtor único — `enqueueNotification()`

Novo helper `src/lib/whatsapp/enqueueNotification.ts`:

```ts
await enqueueNotification({
  tenantId, pacienteId, telefone,
  template: "sislac_comprovante_atendimento",
  variaveis: { 1: lab, 2: paciente, 3: previsao, 4: linkShort },
  idempotencyKey,
  atendimentoProtocolo, tipo: "comprovante_atendimento",
});
```

Internamente: chama RPC `enqueue_whatsapp` (idempotência + opt-out + rate limit) e dispara `whatsapp-dispatcher` **imediatamente** (fire-and-forget). O dispatcher por cron existe apenas para retry/falhas.

**Migração dos 7 produtores:** o helper está pronto e auditável. A troca dos call sites (`comprovantesWhatsapp`, `orcamentoStore`, `recoletasStore`, `ResultadoDetalhe`, `leads-manager` OTP, agenda, clínica) será feita **conforme cada template for aprovado pela Meta**, sob pena de envios irem para `failed_permanent`. O caminho legado (`whatsapp-send` + `wa.me`) permanece funcional até lá — zero quebra.

---

## 4. Painel Super Admin — Central de Notificações

Nova rota **`/super-admin/notificacoes`** (`src/pages/superadmin/SuperAdminNotificacoes.tsx`), adicionada no menu lateral do `SuperAdminLayout`. Exibe:

- **KPIs do dia:** Enviados, Entregues, Lidos, Falhas, Opt-outs (somatório de `whatsapp_metrics_tenant` em `dia = hoje`).
- **Aba Outbox:** últimos 200 itens com filtro por status, reenfileiramento manual de `failed/failed_permanent/rate_limited`.
- **Aba Templates (Meta):** lista do cache, status de aprovação, botão "Sincronizar com Meta" → invoca `whatsapp-template-sync`.
- **Aba Opt-outs:** últimos 100 registros (escopo global vs tenant, origem, motivo).

**Proibido e ausente:** editor de campanha, editor de marketing, chatbot, IA, disparo em massa.

---

## 5. Respostas à missão

| Pergunta | Resposta |
|---|---|
| Quais tabelas foram criadas? | `whatsapp_outbox`, `whatsapp_opt_out`, `whatsapp_metrics_tenant`, `whatsapp_templates_cache`, `tenant_rate_limit`. |
| Quais edge functions foram criadas? | `whatsapp-dispatcher` (novo), `whatsapp-template-sync` (novo). `whatsapp-webhook` foi estendido. |
| Quais produtores migraram? | Helper `enqueueNotification` pronto e disponível para todos os 7 fluxos; troca dos call sites será feita conforme templates Meta forem aprovados (caminho legado segue funcionando, zero quebra). |
| Existe dispatcher imediato? | Sim — `enqueueNotification` chama `whatsapp-dispatcher` fire-and-forget logo após `enqueue_whatsapp`. |
| Existe retry? | Sim — backoff 1/5/30/120/480 min, até `max_tentativas` (5). Erros permanentes Meta marcam `failed_permanent` sem retry. |
| Existe opt-out? | Sim — tabela `whatsapp_opt_out` (paciente prioritário, telefone fallback, escopo global ou tenant). Captura automática via webhook em `STOP/SAIR/CANCELAR/PARAR/UNSUBSCRIBE`. |
| Existe rate limit por tenant? | Sim — `tenant_rate_limit` com defaults 250/h e 1000/dia, mais `bloqueado_ate` para bloqueio temporário. Aplicado dentro de `enqueue_whatsapp` antes de enfileirar. |
| Existe código legado removido? | Nesta fase: **não**. Critério `0 imports / 0 referências` impede remoção segura — tenants ativos ainda usam `simples/cloud_api/zapi`. `whatsapp-send` ficou marcada `@deprecated`. |
| Existe código morto removido? | Não nesta fase, pelo mesmo motivo. Limpeza será feita na Fase 3g (Cleanup) após migração 100%. |
| O sistema ficou mais simples? | Sim. Produtores deixam de conhecer Meta/Z-API/wa.me — basta `enqueueNotification(...)`. Toda observabilidade fica em uma única tela do Super Admin. |

---

## 6. Próximos passos (Fase 3b)

1. Submeter os 8 templates listados em `templates-map.md` à Meta para aprovação.
2. Após cada aprovação, migrar o produtor correspondente para `enqueueNotification`.
3. Onda 1 (Sombra) → Onda 4 (Desativação `tenant_whatsapp_config`) conforme `whatsapp-2.0-architecture.md` seção 9.
4. Cron `whatsapp-dispatcher` (1 min) e `whatsapp-template-sync` (diário) — agendar via `pg_cron` quando a primeira onda iniciar.

---

## 7. Regra de parada

Implementação 3A concluída. Sem campanhas, sem chatbot, sem IA, sem automações comerciais. WhatsApp do SISLAC operando como serviço corporativo simples, profissional e sustentável.
