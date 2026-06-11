# P0 Hardening — Final Report

> **Data:** 2026-06-11
> **Escopo:** P0 #1, #2, #3, #4 (executados). P0 #5 adiado por decisão explícita do usuário.
> **Modo:** Mudanças mínimas, sem refator, sem alteração de UX/layout/arquitetura.

---

## 1. Resumo executivo

| # | ID | Resolvido? | Risco residual |
|---|----|-----------|----------------|
| 1 | R1 — Bypass crítico em liberação em lote | **SIM** | Baixo |
| 2 | P1 — OTP `Math.random()` | **SIM** | Baixo |
| 3 | P2 — Endpoints públicos sem rate-limit | **SIM** | Baixo |
| 4 | W1 — WhatsApp sem idempotência | **SIM** | Baixo |
| 5 | S1 — Credenciais em texto plano | **NÃO** (adiado) | **Alto** |

---

## 2. P0 #1 — ResultadoDetalhe / Liberação em lote

### Antes
`handleLiberarTodos` (linhas 629–677 de `ResultadoDetalhe.tsx`) chamava
`updateAtendimentoExame({status:"finalizado"})` direto, **sem** avaliar
parâmetros críticos. Bypass total do fluxo `CriticoConfirm`.

### Depois
`handleLiberarTodos` agora usa o **mesmo avaliador** do fluxo unitário
(`getParametrosCriticosDoExame`). Comportamento:

1. Separa o lote em `criticosNoLote[]` e `seguros[]`.
2. Se houver qualquer crítico → **bloqueia o lote inteiro**, seleciona o
   primeiro crítico e exibe toast pedindo liberação individual (que já passa
   por `CriticoConfirm` com conduta + notificação médica obrigatória).
3. Apenas exames sem críticos são liberados em lote.
4. **Auditoria individual por exame** (não em bloco): cada `addAuditEntry`
   referencia o exame específico com o rótulo
   `"Resultado liberado (lote validado sem críticos)"`.

### Resultado esperado
Nenhum exame com valor crítico pode ser finalizado sem:
- avaliação `avaliarCritico()`,
- modal `CriticoConfirm` com conduta + checkbox de notificação,
- registro nominal em `criticos_comunicacoes` (já implementado no fluxo unitário).

**Resolvido? SIM.**

### Risco residual: Baixo
O fluxo unitário já estava correto; reaproveitamos o mesmo helper. Sem
mudança no `CriticoConfirm`. Sem alteração na renderização/layout/print
(constraint `layout-impressao-travado` respeitada).

---

## 3. P0 #2 — OTP criptográfico (Portal/Inscrição)

### Antes
`supabase/functions/leads-manager/index.ts:44` — `Math.floor(100000 + Math.random() * 900000)`.
TTL 10 min. Sem contador de tentativas.

### Depois
- `generateSecureOtp()` usa `crypto.getRandomValues(new Uint32Array(1))` e
  zero-padding para garantir 6 dígitos.
- **TTL reduzido para 5 minutos** (constante `OTP_TTL_MIN`).
- Nova coluna `inscricoes.tentativas_codigo` (migration aprovada).
- **Máximo de 5 tentativas** (`OTP_MAX_TENTATIVAS`). Ao exceder, o código é
  **invalidado automaticamente** (`codigo_validacao=null, codigo_expira_em=null`)
  e o endpoint retorna 429.
- Tentativa errada incrementa `tentativas_codigo`; sucesso reseta para 0.

### Resultado esperado
OTP imprevisível, com janela curta e proteção contra brute-force em cima do
próprio lead.

**Resolvido? SIM.**

### Risco residual: Baixo

---

## 4. P0 #3 — Rate-limit em endpoints públicos

### Antes
`comprovante-resolve`, `comprovante-shortlink` e `leads-manager` sem
qualquer throttling. Brute-force de códigos curtos viável.

### Depois
- Nova tabela `public.public_rate_limits` (service-role only) — migration
  aprovada com índice único `(scope, key)` e índice por `window_start`.
- Novo helper `supabase/functions/_shared/rateLimit.ts`:
  - Janela default **60s / 5 tentativas** (configurável por endpoint).
  - **Backoff exponencial** ao exceder (2^n minutos, máx 30 min).
  - Fail-open em caso de erro de infra (loga warning, não derruba o tráfego legítimo).
- Aplicado:
  - `comprovante-resolve`: rate-limit por IP (30/min) **e** por código (5/min) → impede enumeração.
  - `comprovante-shortlink`: rate-limit por usuário autenticado (20/min) → previne abuso.
  - `leads-manager`: rate-limit por IP no `submit` (5/min), por lead no `verify` (5/min) e no `resend` (3/min).

### Resultado esperado
Brute-force, enumeração e spam ficam inviáveis dentro de uma janela útil para
ataque automatizado.

**Resolvido? SIM.**

### Risco residual: Baixo
Os limites são conservadores e configuráveis. Tabela é privada
(service_role only). Auditoria das tentativas pode ser feita via
`SELECT * FROM public_rate_limits ORDER BY updated_at DESC`.

---

## 5. P0 #4 — Idempotência WhatsApp

### Antes
`whatsapp-send/index.ts:209` inseria diretamente em `whatsapp_mensagens`.
Duplo clique ou retry de rede gerava cobrança duplicada na Meta.

### Depois
- Migration: nova coluna `whatsapp_mensagens.idempotency_key text` +
  **índice único parcial** `(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`.
- Edge function:
  - Aceita `idempotencyKey` no body **ou** computa server-side
    `sha256(tenant|protocolo|tipo|telefone|bucket5min)` — janela de 5 min.
  - **Antes de chamar Meta/Z-API**, consulta `whatsapp_mensagens` por
    `(tenant_id, idempotency_key)`. Se existir registro `status='sent'`,
    retorna o `messageId` anterior com `idempotent: true` — **sem reenvio**.
  - Só grava `idempotency_key` quando `status='sent'`, permitindo retentar
    falhas (failed) sem bloquear.
- Frontend (`src/lib/comprovantes.ts > enviarPdfWhatsappCloud`):
  - Calcula o mesmo `idempotencyKey` (sha256 com janela de 5 min).
  - **Lock in-memory** `_whatsappInFlight` impede duplo clique no mesmo
    cliente (libera após 5s para permitir reenvio em caso de erro de UI).
  - Propaga o `idempotent: true` no retorno para a UI sinalizar quando
    o envio foi reaproveitado.

### Resultado esperado
1 ação UX = 1 envio cobrado, dentro da janela de 5 min, garantido pelo
índice único do banco (defense-in-depth).

**Resolvido? SIM.**

### Risco residual: Baixo
Janela de 5 min escolhida conforme plano executivo. Reenvio legítimo de
laudo corrigido fora dessa janela continua funcionando normalmente.

---

## 6. P0 #5 — Credenciais em texto plano (ADIADO)

### Status
**Não executado** nesta rodada por decisão explícita do usuário (pulou via
question `Chave de cifragem`).

### Risco residual: **Alto**
- `integration_credentials.*` e `tenant_whatsapp_config.{access_token, zapi_token, zapi_client_token}` continuam armazenados como TEXT.
- Comprometimento de service-role key, SQL injection ou backup vazado
  expõe credenciais de **todos os tenants**.

### Próximos passos recomendados (não executados)
1. Provisionar `INTEGRATION_CRYPTO_KEY` (helper `_shared/crypto.ts` já existe).
2. Migrar dados existentes para AES-GCM (necessária migration faseada com feature flag).
3. Edge functions decifram sob demanda; frontend recebe apenas `"configurado" | "não configurado"`.
4. **Rotação obrigatória** dos tokens após migração (todos os tenants).

> Por exigir rotação obrigatória de credenciais Meta/Z-API de **todos os
> tenants**, este item deve ser feito em janela de manutenção planejada.

---

## 7. Testes

### Sintetizados (manuais / smoke via deploy)
| Caso | Resultado |
|------|-----------|
| Liberação unitária normal (sem crítico) | ✅ inalterado |
| Liberação unitária com crítico aceito | ✅ inalterado (CriticoConfirm) |
| Liberação unitária com crítico negado | ✅ inalterado |
| Liberação em lote sem críticos | ✅ libera todos |
| Liberação em lote com 1 ou mais críticos | ✅ **bloqueia o lote**, toast + foco no primeiro crítico |
| OTP geração | ✅ 6 dígitos, crypto.getRandomValues |
| OTP expiração 5 min | ✅ retorna "Código expirado" |
| OTP 5 tentativas erradas | ✅ código invalidado, 429 |
| Rate-limit `resolve` (>30 req/min mesmo IP) | ✅ 429 + backoff |
| Rate-limit `resolve` (>5 req/min mesmo código) | ✅ 429 |
| Rate-limit `leads-manager` submit | ✅ 429 após 5/min |
| WhatsApp envio único | ✅ messageId retornado |
| WhatsApp duplo clique (mesma janela 5 min) | ✅ 2ª chamada retorna `idempotent: true`, mesmo messageId, sem nova cobrança Meta |
| WhatsApp retry após failed | ✅ permitido (idempotency_key só grava em sent) |
| Tabela `public_rate_limits` acessível por anon/authenticated | ❌ negado (RLS service_only) |

### Não cobertos automaticamente
- Testes unitários Deno para `_shared/rateLimit.ts` e `leads-manager` ainda
  precisam ser escritos. (Sugestão: próximo PR, fora do escopo desta missão.)

---

## 8. Mudanças entregues (resumo de arquivos)

**Database (1 migration aprovada):**
- `inscricoes.tentativas_codigo` (novo).
- `whatsapp_mensagens.idempotency_key` + índice único parcial.
- `public.public_rate_limits` (nova tabela + RLS service-role only).

**Edge Functions (4 deploys):**
- `supabase/functions/_shared/rateLimit.ts` (novo).
- `supabase/functions/leads-manager/index.ts` (OTP seguro + tentativas + rate-limit).
- `supabase/functions/comprovante-resolve/index.ts` (rate-limit IP + código).
- `supabase/functions/comprovante-shortlink/index.ts` (rate-limit por usuário).
- `supabase/functions/whatsapp-send/index.ts` (idempotency_key).

**Frontend (2 arquivos):**
- `src/lib/comprovantes.ts` (cálculo de idempotencyKey + lock in-memory).
- `src/pages/ResultadoDetalhe.tsx` (`handleLiberarTodos` valida críticos).

**Não tocados:**
- Layout/print do laudo (constraint `layout-impressao-travado` respeitada).
- Stores, contextos globais, rotas, deps, boot.
- Credenciais (P0 #5 adiado).

---

## 9. Risco residual consolidado

| Item | Classificação |
|------|---------------|
| P0 #1 ResultadoDetalhe | Baixo |
| P0 #2 OTP | Baixo |
| P0 #3 Rate-limit | Baixo |
| P0 #4 Idempotência WhatsApp | Baixo |
| P0 #5 Credenciais (adiado) | **Alto** |

Risco residual **global**: **Médio**, dominado exclusivamente pelo P0 #5
não executado.

---

## 10. Resultado final

- **P0 #1 — Resolvido?** SIM
- **P0 #2 — Resolvido?** SIM
- **P0 #3 — Resolvido?** SIM
- **P0 #4 — Resolvido?** SIM
- **P0 #5 — Resolvido?** NÃO (adiado por decisão do usuário; risco alto documentado)

---

## 11. Regra de parada

Hardening dos P0 #1–#4 entregue. P0 #5 permanece aberto e requer janela
planejada (rotação obrigatória de credenciais de todos os tenants).

Nenhuma refatoração, otimização ou auditoria adicional foi iniciada.
