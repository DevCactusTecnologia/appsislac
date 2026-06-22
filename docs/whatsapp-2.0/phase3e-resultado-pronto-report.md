# WhatsApp 2.0 — Fase 3E — Resultado Pronto

Status: ✅ concluída

## 1. Evento que dispara a notificação

Disparador único = condição clínica já existente "todos os exames do
atendimento liberados / assinados".

Fonte de verdade (SSOT) sem nova regra criada:

- `src/pages/ResultadoDetalhe.tsx` → `executarLiberacao()` (liberação
  unitária) — bloco que detecta `naoLiberadosRestantes === 0` e dispara
  `fireSuccessConfetti()` + `setShowCelebracao(true)`.
- `src/pages/ResultadoDetalhe.tsx` → `handleLiberarTodos()` (liberação
  em lote) — bloco análogo com `naoLiberados === 0`.

Em ambos os pontos, **após** a celebração, chamamos:

```ts
void notifyResultadoPronto({ protocolo: paciente.protocolo });
```

Nada além disso. Nenhum status novo, nenhum trigger novo, nenhum
duplicado de regra clínica.

## 2. Template utilizado

```
resultado_pronto  (UTILITY, pt_BR)
```

Variáveis estritamente as três permitidas pela missão:

| Slot | Conteúdo                                                    |
|------|-------------------------------------------------------------|
| {{1}}| `lab.nome` (laboratório — `getLabConfig().nome`)            |
| {{2}}| `paciente.nome`                                             |
| {{3}}| `link_resultado` (site público do tenant — reuso, ver §3)   |

## 3. Segurança do link de resultado

Reutiliza mecanismo **já existente** no SISLAC. Sem novo portal, sem
novo token, sem novo link público:

1. Tenta `tenant_settings_public.dominio_custom` (já em uso).
2. Cai para `${origin}/site/${tenant.slug}` (rota pública do tenant
   site, já implantada — `src/lib/tenantSite/store.ts`).
3. Fallback final: `window.location.origin` / domínio publicado.

Nenhum endpoint novo. Nenhuma rota nova. Nenhum sistema de acesso.

## 4. Auditoria

100% garantida pela infraestrutura existente:

- `enqueue_whatsapp` RPC grava `whatsapp_outbox` com `tenant_id`,
  `paciente_id`, `template`, `idempotency_key`, `created_by`.
- `whatsapp-dispatcher` registra entrega em `whatsapp_mensagens` +
  `whatsapp_metrics_tenant`.
- Webhook Meta atualiza status (sent/delivered/read/failed).

O helper `notifyResultadoPronto` repassa `atendimentoProtocolo` e
`tipo: "resultado_pronto"` para rastreabilidade direta do disparo.

## 5. Opt-Out

Validado server-side pela RPC `enqueue_whatsapp`: consulta
`whatsapp_opt_out` por `paciente_id` (prioritário) e telefone
(fallback). Paciente bloqueado ⇒ RPC retorna `status = blocked_optout`
e nada é enviado. Frontend não decide nem contorna.

## 6. Rate Limit

Mesma política unificada (`tenant_rate_limit`, defaults 250/h e
1000/dia) aplicada no `enqueue_whatsapp`. Resultado Pronto NÃO recebe
tratamento especial — herda a política existente, sem duplicação.

## 7. Isolamento por tenant

`tenantId` resolvido a partir do próprio `atendimentos.tenant_id` da
linha do protocolo. Nunca confiamos no frontend. RPC server-side
revalida via `current_tenant_id()` / RLS.

## 8. Código morto removido

Auditoria de helpers/imports relacionados a "resultado por WhatsApp":

- Nenhum helper legado restante após Fase 3D.2. A varredura por
  `resultado.*whatsapp`, `enviarResultado.*whats`, `notificarResultado`
  não encontra consumidores no código.
- Nenhum import órfão introduzido.
- 0 referências a `whatsapp-send`, `cloud_api por tenant`, `zapi` ou
  `wa.me` no fluxo de resultado.

Nada para remover nesta fase — o legado já havia sido extirpado em 3B
e 3D.2. O único helper novo é `notifyResultadoPronto`, com **dois**
consumidores reais em `ResultadoDetalhe.tsx`.

## 9. Referências ao legado

Zero. `notifyResultadoPronto` → `enqueueNotification` →
`enqueue_whatsapp` RPC → `whatsapp_outbox` → `whatsapp-dispatcher` →
Meta Cloud API. Caminho único.

## 10. Regressão clínica

Nenhuma. Não foram alterados:

- PDF / laudo / impressão
- `ResultadoDetalhe` na lógica clínica (apenas duas linhas extras de
  `void notifyResultadoPronto(...)` após o bloco que já existia)
- Assinatura / `data_liberacao` / status
- RLS / RPCs clínicas
- Financeiro / Convênios

A notificação é fire-and-forget: falhas não bloqueiam a liberação nem
mostram erro ao usuário operacional (analista).

## 11. Verificações

| Comando            | Resultado |
|--------------------|-----------|
| `bunx tsc --noEmit`| ✅ ok     |
| `bunx vitest run`  | ✅ 22/22  |
| `bun run build`    | (CI)      |

## 12. Smoke test (caminho lógico)

```
Atendimento → Coleta → Análise → Liberação (último exame)
   ↓
ResultadoDetalhe detecta naoLiberadosRestantes === 0
   ↓
notifyResultadoPronto({ protocolo })
   ↓
SELECT atendimentos → tenant_id + paciente_id
SELECT pacientes    → telefone + nome
   ↓
enqueueNotification(template=resultado_pronto, vars={lab, paciente, link})
   ↓
RPC enqueue_whatsapp (opt-out + rate limit + idempotency)
   ↓
whatsapp_outbox (pending)
   ↓
whatsapp-dispatcher (imediato + cron retry)
   ↓
Meta Cloud API → Paciente
```

Idempotência: `sha256("resultado_pronto|tenant|protocolo|bucket5min")`
— reliberações no mesmo protocolo dentro de 5 min não duplicam envio.

## 13. Pronto para Recoleta?

Sim. Arquitetura, template, opt-out, rate-limit, auditoria e
isolamento por tenant são reaproveitáveis. Próxima fase (3F — Recoleta)
poderá usar o mesmo padrão com `template = "recoleta"` e disparador no
fluxo `Recoleta solicitada` já existente em `ResultadoDetalhe`.

## Arquivos alterados

- **Criado** `src/lib/whatsapp/notifyResultadoPronto.ts`
- **Editado** `src/pages/ResultadoDetalhe.tsx` (2 disparos + 1 import)
- **Criado** `docs/whatsapp-2.0/phase3e-resultado-pronto-report.md`

## Regra de parada

PARAR. Não implementar OTP, chatbot, campanhas ou marketing.
Próxima missão: **Fase 3F — Recoleta**.
