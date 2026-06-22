# WhatsApp 2.0 — Fase 3E.1 — Políticas de envio por laboratório

Status: ✅ concluída

## 1. Políticas criadas

Política única por tipo de notificação, valor `automatic` ou `manual`:

| Tipo                         | Coluna                   | Default      |
|------------------------------|--------------------------|--------------|
| Resultado pronto             | `resultado_pronto_mode`  | `automatic`  |
| Recoleta                     | `recoleta_mode`          | `manual`     |
| Orçamento                    | `orcamento_mode`         | `manual`     |
| Comprovante de atendimento   | `atendimento_mode`       | `automatic`  |
| Comprovante de agendamento   | `agendamento_mode`       | `automatic`  |
| Confirmação de consulta      | `consulta_mode`          | `automatic`  |

## 2. Onde ficam armazenadas

Tabela única: `public.tenant_notification_settings` (PK = `tenant_id`).

- Type `public.notification_mode` (`automatic` | `manual`).
- RLS habilitada:
  - SELECT: usuário do próprio tenant ou super admin.
  - INSERT/UPDATE: exige `has_permission(auth.uid(), 'configurar_lab')`
    no próprio tenant ou super admin.
- GRANT: `SELECT/INSERT/UPDATE` para `authenticated`, `ALL` para
  `service_role`.
- Trigger padrão `update_updated_at_column`.

## 3. Como o modo é resolvido

Serviço único `src/lib/whatsapp/notificationPolicy.ts`:

```ts
getNotificationMode(tenantId, "resultado_pronto") // -> "automatic" | "manual"
getNotificationSettings(tenantId)                 // -> objeto completo
saveNotificationSettings(tenantId, settings)
```

Cache em memória de 60 s por tenant. Produtores **não** acessam a tabela
diretamente — só consomem `getNotificationMode`. Quando não há linha,
devolve `DEFAULT_NOTIFICATION_SETTINGS`.

## 4. Duplicação

Zero. Política vive em uma única tabela, atrás de um único serviço, e
alimenta o mesmo `enqueueNotification` → `whatsapp_outbox` →
`whatsapp-dispatcher` → Meta. Sem segunda fila, sem segunda outbox, sem
dispatcher paralelo, sem template adicional.

## 5. Código morto removido

- Comentário antigo em `Configuracoes.tsx` ("Notificações centralizadas
  no Super Admin — sem config por laboratório") removido (agora há, sim,
  configuração por laboratório, mas apenas política).
- Sem novos helpers órfãos, sem duplicação de consulta, sem estados
  mortos. O envio continua atravessando o mesmo helper `enqueueNotification`.

## 6. Resultado Pronto respeita a política?

Sim. `src/lib/whatsapp/notifyResultadoPronto.ts`:

```ts
if (!force) {
  const mode = await getNotificationMode(tenantId, "resultado_pronto");
  if (mode === "manual") return { ok: false, reason: "policy_manual" };
}
```

- Liberação do último exame (auto-fire em `ResultadoDetalhe.executarLiberacao`
  e `handleLiberarTodos`) só envia quando o modo for `automatic`.
- Modo `manual`: o operador usa o menu "Mais ações" → **"Enviar
  WhatsApp ao paciente"** (`MaisAcoesMenu` ganhou `onEnviarWhatsapp` +
  `podeEnviarWhatsapp`). O clique chama `notifyResultadoPronto({force:true})`.

## 7. Recoleta respeita a política?

Política já existe (`recoleta_mode`, default **manual**) e o resolver
está disponível. A migração do produtor de Recoleta entra na próxima
fase (3F) — não foi tocado aqui por contrato (regra de parada).

## 8. Orçamento respeita a política?

Política já existe (`orcamento_mode`, default **manual**). O fluxo atual
de orçamento (`PdfPreviewDialog`) já é **disparado pelo clique do
operador** — comportamento equivalente ao modo `manual`. Quando o
laboratório futuramente marcar `automatic`, basta um único hook chamando
o resolver no ponto de criação do orçamento; a infraestrutura está
pronta. Política gravada e legível desde já.

## 9. Regressão

Nenhuma. Não foram alterados:

- PDF, laudo, impressão.
- Lógica clínica de liberação (`executarLiberacao` mantém o disparo;
  apenas o helper filtra por política antes do enqueue).
- RLS / RPCs clínicas.
- Financeiro / Convênios.
- Outbox / dispatcher / templates Meta.

`tsc --noEmit` ✅ · `vitest run` ✅ 22/22.

## 10. Pronto para Fase 3F?

Sim. Recoleta tem:

- Política gravada (`recoleta_mode`, default manual).
- Resolver pronto (`getNotificationMode(tenantId, "recoleta")`).
- Helper pattern já validado (`notifyResultadoPronto`).
- Template a ser registrado no Meta + sincronizado em
  `whatsapp_templates_cache` (Fase 3C cobre o fluxo).

## Arquivos

- **Migration:** `tenant_notification_settings` (+ type
  `notification_mode`, RLS, GRANTs, trigger).
- **Criado:** `src/lib/whatsapp/notificationPolicy.ts`
- **Criado:** `src/components/configuracoes/NotificacoesTab.tsx`
- **Editado:** `src/pages/Configuracoes.tsx` (registra a aba "Notificações")
- **Editado:** `src/lib/whatsapp/notifyResultadoPronto.ts` (consulta política + `force`)
- **Editado:** `src/components/resultado/MaisAcoesMenu.tsx` (item "Enviar WhatsApp")
- **Editado:** `src/pages/ResultadoDetalhe.tsx` (handler + 2 instâncias do menu)
- **Criado:** `docs/whatsapp-2.0/phase3e1-notification-policies-report.md`

## Regra de parada

PARAR. Próxima missão: **Fase 3F — Recoleta**.
