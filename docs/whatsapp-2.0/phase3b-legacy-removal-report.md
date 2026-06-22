# WhatsApp 2.0 — Fase 3B — Relatório de Corte do Legado

> **Status:** ✅ Concluído  
> **Data:** 2026-06-22  
> **Build:** `tsc --noEmit` ✅ • `vitest run` ✅ (22/22)

---

## 1. Contexto

Auditoria confirmou que **nenhuma instalação produtiva** usava o WhatsApp legado
(`simples`, `cloud_api` por tenant, `zapi`). Não havia migração a fazer —
apenas **substituição arquitetural**. Esta fase removeu de forma definitiva
toda a superfície legada, deixando o sistema **exclusivamente Meta
Centralizada**.

---

## 2. Arquivos removidos

### Backend (edge functions)
- `supabase/functions/whatsapp-send/` — função legada (Cloud API por tenant +
  Z-API). Removida do filesystem e **desimplantada do projeto**.

### Frontend (componentes e telas)
- `src/components/configuracoes/WhatsappCloudConfig.tsx` — form de
  configuração por laboratório (modo / phone_number_id / access_token /
  zapi_instance_id / zapi_token / zapi_client_token / webhook_verify_token).
- `src/components/configuracoes/NotificacoesTab.tsx` — aba de
  *Configurações › Notificações* que hospedava o form acima.

---

## 3. Tabelas e tipos removidos do banco

Migração `20260622164238` — `DROP ... CASCADE`:

| Objeto | Tipo | Registros antes do DROP |
| --- | --- | --- |
| `public.tenant_whatsapp_config` | tabela | **0** |
| `public.whatsapp_modo` | enum (`simples` / `cloud_api` / `zapi` / `centralized`) | — |

Verificação prévia: `SELECT count(*) FROM public.tenant_whatsapp_config` → 0.
Nenhuma outra tabela referenciava o enum.

---

## 4. Rotas removidas

| Rota | Origem | Destino |
| --- | --- | --- |
| *Configurações › Notificações* (tab `notificacoes` em `/configuracoes`) | menu + `renderTab()` | substituído por `/super-admin/notificacoes` |

Nenhuma rota top-level foi adicionada ou removida — apenas a tab interna.

---

## 5. Componentes / hooks / stores removidos

- **Componentes:** `WhatsappCloudConfig`, `NotificacoesTab` (descritos
  acima). Ícone `Bell` removido da `Configuracoes.tsx`.
- **Helpers/serviços:** `enviarPdfWhatsappCloud()` removido de
  `src/domains/result/services/comprovantesWhatsapp.ts`. O módulo agora
  exporta **apenas** `buildWaUrl()` (link `wa.me` para
  compartilhamento manual no `PdfPreviewDialog`). O re-export em
  `src/lib/comprovantes.ts` foi reduzido.
- **PdfPreviewDialog:** removido o caminho "envio oficial via Cloud API por
  tenant". O botão WhatsApp agora apenas gera shortlink + abre
  `wa.me`. O envio oficial é feito pelo produtor de domínio (e.g.
  finalização de atendimento) via `enqueueNotification()`.
- **Hooks/stores:** nenhum hook ou store legado WhatsApp existia — todo o
  estado vivia no form do `WhatsappCloudConfig`. Sem órfãos.

---

## 6. Backend — limpezas pontuais

- `supabase/functions/whatsapp-webhook/index.ts`
  - Handshake **GET** agora aceita **apenas** `WHATSAPP_META_VERIFY_TOKEN`
    (fallback `tenant_whatsapp_config.webhook_verify_token` removido).
  - Validação de assinatura **POST** agora aceita **apenas**
    `WHATSAPP_META_APP_SECRET` (fallback `WHATSAPP_APP_SECRET` removido).
- `supabase/functions/super-admin-test-integration/index.ts`
  - Provider WhatsApp restrito a `"meta"`. Branches `twilio` e `zapi`
    excluídas.
- `supabase/functions/super-admin-tenant-backup/index.ts`
  - `tenant_whatsapp_config` removida da lista de tabelas do backup.
- `src/pages/superadmin/SuperAdminConfiguracoes.tsx`
  - Tipo `WhatsappConfig.provider` restrito a `"meta"`. Select de provedor
    substituído por etiqueta fixa "Meta Cloud API (oficial) — centralizado".
  - Texto auxiliar atualizado (sem menção a Twilio / Z-API).

---

## 7. Verificações finais

| Busca | Resultado |
| --- | --- |
| `rg "zapi\|cloud_api\|whatsapp-send\|tenant_whatsapp" src/ supabase/functions/` | **0 referências de código** (apenas 1 menção em comentário do `comprovantesWhatsapp.ts` explicando o que **foi** removido) |
| `rg "whatsapp" src/` | apenas o caminho novo: `enqueueNotification`, `whatsapp_outbox`, `SuperAdminNotificacoes`, `buildWaUrl` (wa.me), helpers de telefone do paciente |
| `bunx tsc --noEmit` | ✅ sem erros |
| `bunx vitest run` | ✅ 22/22 |

> Permanecem referências históricas apenas em `docs/whatsapp-2.0/*.md` (relatórios
> de auditoria das fases 1 e 2), em migrações antigas dentro de
> `supabase/migrations/` (history imutável) e no `src/integrations/supabase/types.ts`
> gerado automaticamente — todos esperados e sem impacto em runtime.

---

## 8. Arquitetura final

```
Produtor de domínio (atendimento, agenda, resultados, orçamento, recoleta, OTP)
        │
        ▼
enqueueNotification()        ◄── único ponto de entrada autorizado
        │
        ▼
public.whatsapp_outbox       ◄── fila + idempotência + rate-limit + opt-out
        │
        ▼
whatsapp-dispatcher          ◄── edge function (imediato + cron retry)
        │
        ▼
Meta Cloud API (corporativa) ◄── 1 conta • 1 número • 1 token (secrets)
        │
        ▼
Paciente
```

Gestão exclusiva em `/super-admin/notificacoes`. Nenhum laboratório
possui menu, tela, token, webhook ou número próprio.

---

## 9. Resposta às perguntas do briefing

| Pergunta | Resposta |
| --- | --- |
| Quais arquivos foram removidos? | `whatsapp-send/`, `WhatsappCloudConfig.tsx`, `NotificacoesTab.tsx` |
| Quais tabelas foram removidas? | `tenant_whatsapp_config` (0 registros) |
| Quais rotas foram removidas? | Tab `?tab=notificacoes` em `/configuracoes` |
| Quais componentes foram removidos? | `WhatsappCloudConfig`, `NotificacoesTab` |
| Quais stores foram removidas? | Nenhuma — não existiam stores WhatsApp legadas |
| Quais hooks foram removidos? | Nenhum — não existiam hooks WhatsApp legados |
| Existe alguma referência ao legado? | **Não em código de runtime.** Restam apenas docs históricas + migrações antigas |
| Existe algum provider antigo restante? | Não. Provider único: `"meta"` |
| O sistema ficou exclusivamente Meta Centralizada? | **Sim.** |
| Houve regressão? | Não. `tsc` ✅ e `vitest` ✅ (22/22) |

---

## 10. Critério de sucesso

- ✅ 1 Arquitetura (`enqueueNotification → outbox → dispatcher → Meta`)
- ✅ 1 Número (centralizado via secrets `WHATSAPP_META_*`)
- ✅ 1 Conta Meta corporativa
- ✅ 1 Painel Super Admin (`/super-admin/notificacoes`)
- ✅ 0 Legado / 0 Z-API / 0 Cloud API por tenant / 0 `whatsapp-send`

**PARAR.** Próxima fase (cadastro de templates Meta + ativação dos produtores)
fica fora do escopo desta missão.
