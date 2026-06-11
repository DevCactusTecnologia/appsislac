# P0 Remediation Plan — Executive Hardening

> **Fontes:** `docs/audits/critical-flows-executive-report.md` · `docs/audits/critical-flows-single-source-of-truth.md`
> **Modo:** Planejamento somente. Nenhum código, migration ou RLS alterada.
> **Data:** 2026-06-11

---

## 1. Resumo dos 5 P0 identificados

| # | ID | Módulo | Severidade | Prioridade |
|---|----|--------|------------|------------|
| 1 | R1 | ResultadoDetalhe | **P0 Bloqueante** | 1 |
| 2 | P1 | Portal do Paciente | **P0 Bloqueante** | 2 |
| 3 | P2 | Portal do Paciente | **P0 Bloqueante** | 3 |
| 4 | W1 | WhatsApp / Z-API | **P0 Bloqueante** | 4 |
| 5 | S1 | SuperAdmin | **P0 Bloqueante** | 5 |

Critério de classificação:
- **P0 Bloqueante** — risco clínico, financeiro direto ou de segurança que impede escala / exposição pública.
- **P1 Alto** — divergência funcional ou dívida com impacto operacional próximo.
- **P2 Médio** — hardening recomendado em sprint dedicada.
- **P3 Baixo** — melhoria incremental, sem risco imediato.

---

## 2. Detalhamento por P0

### P0 #1 — R1 · Bypass de valores críticos em liberação em lote

1. **Módulo afetado:** ResultadoDetalhe (operacional clínico).
2. **Arquivo(s):** `src/pages/ResultadoDetalhe.tsx` linhas **629–677** (`handleLiberarTodos`); fluxo relacionado em **567 / 592** (`handleAnalisarLiberar` → `executarLiberacao`).
3. **Causa raiz:** `handleLiberarTodos` chama `updateAtendimentoExame({status:"finalizado"})` direto, sem invocar `getParametrosCriticosDoExame` nem abrir `CriticoConfirm`; o fluxo unitário também não força `handleSalvar` antes da liberação.
4. **Impacto real:** Resultados fora de faixa segura podem ser liberados ao paciente sem alerta médico nem justificativa do analista. Risco regulatório (RDC 786/2023) e clínico direto.
5. **Probabilidade:** **Alta** em operação de bancada com lotes grandes (uso real diário do botão "Liberar Todos").
6. **Correção recomendada:**
   - Reutilizar o pipeline unitário (avaliar críticos → `CriticoConfirm` → autosave → finalizar) dentro do loop de `handleLiberarTodos`.
   - Bloquear liberação se houver `dirty` não salvo; chamar `handleSalvar` antes de marcar `finalizado`.
   - Registrar auditoria por exame, não em bloco.
7. **Complexidade da correção:** **Média** (≈ 1–2 dias). Reuso de helpers existentes; sem refator estrutural.
8. **Risco de regressão:** **Médio** — fluxo crítico já em produção; exige testes E2E cobrindo: liberação normal, com crítico aceito, com crítico negado, com dado não salvo.
9. **Ordem de prioridade:** **1** (risco clínico imediato).

---

### P0 #2 — P1 · OTP gerado com `Math.random()`

1. **Módulo afetado:** Portal do Paciente.
2. **Arquivo(s):** `supabase/functions/leads-manager/index.ts` linha **44**.
3. **Causa raiz:** Geração do código OTP via `Math.random()` (PRNG não criptográfico, previsível).
4. **Impacto real:** Atacante pode prever sequência de OTPs e validar leads/solicitações em nome de terceiros; vazamento de dados pessoais (LGPD).
5. **Probabilidade:** **Média–Alta** se o endpoint for descoberto; trivial de explorar.
6. **Correção recomendada:** Substituir por `crypto.getRandomValues(new Uint32Array(1))` (Deno tem Web Crypto nativo); manter 6 dígitos zero-padded; adicionar TTL curto (5–10 min) e contador de tentativas.
7. **Complexidade:** **Baixa** (< 2 horas).
8. **Risco de regressão:** **Baixo** — alteração isolada; mesma assinatura/retorno.
9. **Ordem de prioridade:** **2**.

---

### P0 #3 — P2 · Endpoints públicos sem rate-limit

1. **Módulo afetado:** Portal do Paciente.
2. **Arquivo(s):** `supabase/functions/comprovante-resolve/index.ts`, `supabase/functions/leads-manager/index.ts`, `supabase/functions/comprovante-shortlink/index.ts`.
3. **Causa raiz:** Endpoints anônimos sem throttling por IP/CPF; código de comprovante tem espaço de busca limitado (32^6 ≈ 1B), brute-force viável sem rate-limit.
4. **Impacto real:** Enumeração de CPF, brute-force de códigos curtos, abuso de OTP/WhatsApp (custo financeiro e ban no Meta Business Account).
5. **Probabilidade:** **Alta** assim que houver exposição pública (Portal aberto na internet).
6. **Correção recomendada:**
   - Adicionar rate-limit por IP + por chave (CPF/código) usando tabela `rate_limits` com `pg_advisory_lock` ou contadores TTL.
   - Backoff exponencial após N tentativas.
   - Logar tentativas em `audit_logs` para detecção.
7. **Complexidade:** **Média** (≈ 2 dias). Infra reusável entre as 3 funções.
8. **Risco de regressão:** **Baixo** — limiar configurável; pode iniciar em modo "log-only" antes de bloquear.
9. **Ordem de prioridade:** **3**.

---

### P0 #4 — W1 · Envio WhatsApp sem chave de idempotência

1. **Módulo afetado:** WhatsApp / Z-API.
2. **Arquivo(s):** `supabase/functions/whatsapp-send/index.ts` linha **209** (insert em `whatsapp_mensagens`); chamadas a partir de `src/lib/comprovantes.ts`.
3. **Causa raiz:** Sem `idempotency_key` na request e sem índice único em `(tenant_id, atendimento_protocolo, tipo_documento)`; cada clique/retentativa gera novo envio cobrado.
4. **Impacto real:** Cobrança duplicada de mensagens (Meta cobra por conversa), spam ao paciente, risco de penalização de qualidade no Meta Business.
5. **Probabilidade:** **Alta** — duplo clique, retry de rede ou re-render disparam novamente.
6. **Correção recomendada:**
   - Gerar `idempotency_key = sha256(tenant_id|protocolo|tipo|telefone|janela_5min)` no frontend.
   - Índice único parcial em `whatsapp_mensagens` para a janela; edge function retorna o envio anterior em vez de re-disparar.
   - Botão UI bloqueado durante envio + estado "enviado nos últimos 5 min".
7. **Complexidade:** **Média** (≈ 1–2 dias). Inclui migration de índice.
8. **Risco de regressão:** **Médio** — exige cuidado para não bloquear reenvios legítimos (laudo corrigido). Mitigar com `tipo_documento` granular.
9. **Ordem de prioridade:** **4**.

---

### P0 #5 — S1 · Credenciais de integração em texto plano

1. **Módulo afetado:** SuperAdmin / Integrações de tenant.
2. **Arquivo(s):** Tabela `integration_credentials` e `tenant_whatsapp_config` (colunas `access_token`, `zapi_token`, `zapi_client_token`); leitura em `src/components/configuracoes/WhatsappCloudConfig.tsx:127-148, 195-200`.
3. **Causa raiz:** Tokens persistidos como `TEXT` sem cifragem em repouso; também retornados ao frontend para preencher formulário.
4. **Impacto real:** Comprometimento de service-role key, SQL injection ou backup vazado expõe credenciais de todos os tenants simultaneamente — acesso total às contas Meta/Z-API.
5. **Probabilidade:** **Baixa–Média** isoladamente, **Alta em impacto** quando ocorre.
6. **Correção recomendada:**
   - Cifrar com `pgcrypto`/Supabase Vault usando KMS key.
   - Edge function decifra sob demanda; nunca retornar token bruto ao frontend (apenas mascarado ou flag "configurado").
   - Rotação obrigatória após migração.
7. **Complexidade:** **Alta** (≈ 3–5 dias). Migration de dados + ajuste de todas as edge functions que leem credenciais + UI write-only.
8. **Risco de regressão:** **Alto** — qualquer falha quebra envio WhatsApp para todos os tenants. Exige feature flag e rollout faseado por tenant.
9. **Ordem de prioridade:** **5** (alto esforço; pode ser sequenciado após os 4 anteriores).

---

## 3. Sequenciamento recomendado

```text
Sprint 1 (1 semana)  → P0 #2 (OTP) + P0 #1 (Bypass crítico)
Sprint 2 (1 semana)  → P0 #3 (Rate-limit) + P0 #4 (Idempotência WhatsApp)
Sprint 3 (1–2 sem.)  → P0 #5 (Cifragem credenciais + rotação)
```

Critério: começar pelos itens de **baixa complexidade / alto impacto** (OTP, Bypass clínico) para reduzir risco residual rapidamente, deixando a cifragem (alta complexidade, requer rollout faseado) por último.

---

## 4. Itens fora do escopo deste plano

P1/P2 listados no executive report (F1/F2, W2/W3/W4, R2/R3, P3/P4, S2/S3) **não** são tratados aqui. Devem entrar em sprints subsequentes de hardening, conforme seção 3 do executive report.

---

## 5. Regra de parada

Plano executivo entregue. Nenhum código, migration, RLS ou edge function foi alterado. Apenas este documento foi criado em `docs/audits/p0-remediation-plan.md`.
