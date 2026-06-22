# WhatsApp 2.0 — Fase 1.7 — Complexidade e Legado

> **Esta fase apenas DOCUMENTA. Nada é removido nem deprecado.**

## Código morto / suspeito

| Item | Local | Observação |
|---|---|---|
| Modo `zapi` (Z-API) | `tenant_whatsapp_config.modo='zapi'` + branch em `whatsapp-send` | Solução não-oficial. Coexiste com Cloud API. Será supérfluo após centralização Meta. |
| Modo `simples` (wa.me) | branch no `whatsapp-send` (retorna 412) + frontend `buildWaUrl()` | Não passa pelo backend; existe paralelo ao envio oficial. Ainda útil como fallback emergencial. |
| `app_settings.whatsapp_config` (global OTP) | `leads-manager` | Caminho separado do `tenant_whatsapp_config`. Após centralização, pode se unificar com o canal corporativo. |
| `numero_simples` em `tenant_whatsapp_config` | coluna | Só é lida quando `modo='simples'`. Permanece útil para o "fale conosco" do site público. |
| `display_phone` | coluna | Apenas exibição. Continua útil. |
| Botões `wa.me` hardcoded em `Pacientes.tsx`, `Especialistas.tsx`, `Orcamentos.tsx`, `NovoAtendimento.tsx` | 5 ocorrências | Não passam pela fachada `comprovantes.ts`. Bypassam log e configuração — candidatas a refatoração. |

## Integrações abandonadas

| Item | Status |
|---|---|
| Z-API | Funcional mas não-oficial. Nenhum cliente conhecido obrigatório — verificar antes de remover. |
| Webhook por tenant (handshake casa qualquer `webhook_verify_token`) | Funciona, mas em modelo centralizado bastaria 1 token global. |

## Providers antigos

Não há provider antigo (ex.: Twilio, MessageBird) no código. Apenas Meta Cloud API e Z-API.

## Arquivos órfãos

Nenhum arquivo `.ts` exclusivamente WhatsApp sem caller foi encontrado. `comprovantesWhatsapp.ts` é usado por `comprovantes.ts` e `PdfPreviewDialog.tsx`.

## Webhooks sem uso

`whatsapp-webhook` está ativo e validado (HMAC fail-closed). Não há webhooks órfãos.

## Templates sem uso

**Nenhum template existe** — portanto nenhum "sem uso". A criação será parte da Fase 2.

## Pontos de complexidade desnecessária

1. **3 modos coexistindo** (`simples`/`cloud_api`/`zapi`) — triplica a matriz de testes e o painel de configuração.
2. **2 caminhos paralelos para Meta**: `tenant_whatsapp_config` (operacional) e `app_settings.whatsapp_config` (OTP global).
3. **5 chamadas `wa.me` hardcoded** fora da fachada `comprovantes.ts`.
4. **UI de configuração de 491 linhas** (`WhatsappCloudConfig.tsx`) precisa suportar 3 modos × 2 conjuntos de credenciais.
5. **Sem fila** — envios síncronos travam a UI em caso de timeout da Meta.

## Resumo

Legado não bloqueia centralização. As 3 alavancas de simplificação são:

1. Deprecar modo `zapi` quando todos os labs migrarem para o Meta corporativo.
2. Unificar `app_settings.whatsapp_config` (OTP) com o canal centralizado.
3. Refatorar `wa.me` hardcoded para passar pela fachada (gera log + opt-out).
