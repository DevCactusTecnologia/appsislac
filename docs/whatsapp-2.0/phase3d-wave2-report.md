# WhatsApp 2.0 — Fase 3D.2 — Consolidação Final dos Produtores

## Auditoria inicial

`rg "wa\.me|navigator\.share|whatsapp-send|buildWaUrl"` em `src/` + `supabase/`
(excluindo `*.md`) retornou **12 ocorrências** distribuídas assim:

### Categoria A — Fluxo manual de contato (mantido)

Cliques humanos que abrem a conversa no WhatsApp (sem template, sem
disparo automático, sem produtor de notificação). Não passam pela Outbox
porque não são mensagens oficiais do laboratório — são deep-links
equivalentes a um botão "ligar". **Mantidos.**

| Origem | Uso |
|---|---|
| `src/pages/Pacientes.tsx:695` | Botão "WhatsApp" no card do paciente. |
| `src/pages/Especialistas.tsx:432` | Botão "WhatsApp" no card do especialista. |
| `src/pages/superadmin/SuperAdminInscricoes.tsx:399` | Super admin entra em contato com lead. |
| `src/pages/TenantSiteContato.tsx:87` | Link público no site institucional do laboratório. |
| `src/pages/Landing.tsx:473` | Link público da landing SISLAC. |
| `src/components/tenant-site/LandingTemplate.tsx:50` | Link público do template de site do laboratório. |
| `src/components/configuracoes/SiteTab.tsx:283` | Botão "Compartilhar prévia do site" (uso interno do admin do tenant). |

### Categoria B — Marketing / campanha (removido)

| Origem | Uso original | Ação |
|---|---|---|
| `src/pages/Orcamentos.tsx` — `templates.lembrete / .reforco / .ultima`, `sugerirTemplate`, `sendWhatsappTemplate`, popover `templateMenuOrc`, botões "Lembrete/Reforço/Última chance" no mobile + desktop + detalhe | Campanha comercial em 3 estágios (D+2, D+5, D+15) abrindo `wa.me` com mensagem promocional ("condição especial pra fechar esta semana"). | **REMOVIDO**. SISLAC não tem módulo de marketing. |

### Outros hits (não acionáveis)

- `src/components/PdfPreviewDialog.tsx` (3 hits) — apenas **comentários** explicando que `wa.me` não é mais permitido.
- `src/lib/comprovantes.ts:13` — comentário documentando a remoção dos helpers.
- `supabase/migrations/20260430192530_*.sql:14` — texto descritivo histórico do enum legado já removido em 3B.

## Mudanças aplicadas

**`src/pages/Orcamentos.tsx`**

- Removido o tipo `TemplateKey` e o objeto `templates` (3 mensagens de
  marketing com emojis 👋💬⏰ e copy promocional).
- Removida a função `sugerirTemplate(dias)`.
- Removida a função `sendWhatsappTemplate()` — único produtor de `wa.me`
  com `window.open()` automático fora dos links manuais.
- Removido o estado `templateMenuOrc` / `setTemplateMenuOrc`.
- Removido o `StandardDialog` "Escolher template" inteiro (37 linhas).
- Removido o bloco "Templates de WhatsApp" do diálogo de detalhes do
  orçamento (sugestão + 3 botões coloridos).
- Removidos os botões "Lembrete/Reforço/Última via WhatsApp" tanto da
  view mobile quanto da coluna "Ações" da tabela desktop.
- O telefone do paciente continua exibido no diálogo de detalhes (em
  read-only), independentemente de o orçamento estar convertido.

O envio **oficial** do PDF de orçamento (template Meta `orcamento`
aprovado em 3D.1) permanece intacto via `PdfPreviewDialog` →
`enqueueNotification()` → Outbox → Meta.

## Limpeza pós-remoção

```
rg "wa\.me|navigator\.share|whatsapp-send|buildWaUrl" src supabase -g '!*.md'
```

- **0 envios automáticos** restantes.
- **0 usos de `whatsapp-send`** (edge function deletada em 3B).
- **0 usos de `buildWaUrl`** (helper removido em 3D.1).
- **0 usos de `navigator.share`** em todo o projeto.
- Links Cat. A restantes: 7 deep-links 100% manuais (botões/`href`).
- Imports mortos: nenhum — `MessageCircle` e `Send` ainda são usados
  pelo diálogo pós-conversão e cabeçalho do `PdfPreviewDialog`.

## Respostas obrigatórias

- **Quantos usos de `wa.me` restavam?** 12 hits brutos; **1 automático**
  (marketing em Orçamentos) + 7 manuais + 4 em comentários/SQL histórico.
- **Quantos foram migrados?** 0 (nenhum era operacional legítimo
  pendente — Onda 1 já tratou comprovante/orçamento oficiais).
- **Quantos foram removidos?** 1 fluxo completo (3 templates + popover +
  botões + estado).
- **Existe algum envio automático fora da Outbox?** Não.
- **Existe marketing no sistema?** Não.
- **Existe código morto removido?** Sim — `templates`, `TemplateKey`,
  `sugerirTemplate`, `sendWhatsappTemplate`, `templateMenuOrc` e o
  dialog "Escolher template".
- **Existem helpers órfãos removidos?** Sim (os 4 acima).
- **Existem imports mortos removidos?** Não havia — todos os ícones
  importados continuam em uso.
- **Existe regressão?** Não. `tsc --noEmit` ✓ · `vitest run` 22/22 ✓.
- **Está pronto para Resultado Pronto (Fase 3E)?** Sim. A arquitetura
  está limpa: o único caminho de envio automático é
  `enqueueNotification()`.

## Critério de sucesso

✓ 1 arquitetura
✓ 0 envios automáticos via `wa.me`
✓ 0 templates de marketing
✓ 0 produtores fora da Outbox (com exceção das 4 categorias
  explicitamente excluídas desta onda: Resultado Pronto, OTP, Recoleta,
  Confirmação Consulta).

## Próxima missão

Fase 3E — Resultado Pronto.
