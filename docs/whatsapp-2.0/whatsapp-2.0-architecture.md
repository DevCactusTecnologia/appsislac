# WhatsApp 2.0 — Arquitetura Centralizada Meta Corporativa

> **Fase 2 — Documento de Arquitetura.** Esta fase não altera código, banco, edge functions, templates ou webhooks. Objetivo: formalizar a arquitetura-alvo do WhatsApp 2.0 antes de qualquer implementação.

---

## 1. Visão geral

Transformar o WhatsApp do SISLAC de um modelo descentralizado (cada laboratório com seu número/token) em um **serviço corporativo único**:

```text
       ┌──────────────────────────────────────┐
       │     Conta Meta Business SISLAC       │
       │  (1 Phone Number ID • 1 Token)       │
       └──────────────────┬───────────────────┘
                          │
                ┌─────────▼──────────┐
                │ Painel Super Admin │
                │ Central de Notif.  │
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ Lab A   │       │ Lab B   │       │ Lab C   │
   └─────────┘       └─────────┘       └─────────┘
                          │
                ┌─────────▼──────────┐
                │ Templates Meta     │
                │ (aprovados)        │
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │ Pacientes finais   │
                └────────────────────┘
```

O OTP de cadastro (`leads-manager`) já usa uma credencial Meta global — isto comprova viabilidade técnica e serve como blueprint.

---

## 2. Templates Meta a criar

Todos seguem a regra: **`{{1}}` = Nome do Laboratório** (sempre o primeiro parâmetro), garantindo que um único número atenda todos os tenants.

| # | Nome técnico                          | Categoria Meta | Variáveis                                              | Botão / CTA                                                  |
|---|---------------------------------------|----------------|--------------------------------------------------------|--------------------------------------------------------------|
| 1 | `sislac_comprovante_atendimento`      | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` previsão, `{{4}}` link | URL: **Acessar Comprovante**                                |
| 2 | `sislac_comprovante_agendamento`      | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` data/hora, `{{4}}` link | URL: **Acessar Comprovante**                                |
| 3 | `sislac_resultados_prontos`           | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` link            | URL: **Acessar Resultados**                                  |
| 4 | `sislac_orcamento`                    | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` validade, `{{4}}` link | URL: **Acessar Orçamento**                                  |
| 5 | `sislac_recoleta`                     | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` exame, `{{4}}` motivo | URL: **Entrar em Contato**                                   |
| 6 | `sislac_orcamento_clinica`            | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` link            | URL: **Acessar Orçamento**                                   |
| 7 | `sislac_consulta_confirmacao`         | UTILITY        | `{{1}}` lab, `{{2}}` paciente, `{{3}}` profissional, `{{4}}` data/hora | Quick replies: **Confirmar / Cancelar / Solicitar Remarcação** |
| 8 | `sislac_otp_cadastro`                 | AUTHENTICATION | `{{1}}` código                                         | Copy code: **Copiar Código**                                 |

Conteúdo base (template 1) — referência:

```text
Olá, {{2}}.
O comprovante do seu atendimento realizado no {{1}} pode ser acessado no link abaixo.
A previsão de entrega dos resultados dos seus exames é {{3}}.
```

Templates são versionados em `whatsapp_templates` (planejado) e referenciados por `nome+idioma+versão`.

---

## 3. Eventos disparadores

| Evento de domínio                     | Origem (store / função)                          | Template                              |
|---------------------------------------|--------------------------------------------------|---------------------------------------|
| Atendimento finalizado                | `atendimentoStore.finalizar`                     | `sislac_comprovante_atendimento`      |
| Agendamento confirmado                | `atendimentoStore` (agenda)                      | `sislac_comprovante_agendamento`      |
| Resultado liberado                    | `ResultadoDetalhe` → liberação                   | `sislac_resultados_prontos`           |
| Orçamento gerado                      | `orcamentoStore.criar`                           | `sislac_orcamento`                    |
| Recoleta criada                       | `recoletasStore.criar`                           | `sislac_recoleta`                     |
| Orçamento clínico gerado              | módulo clínica (futuro)                          | `sislac_orcamento_clinica`            |
| Consulta agendada                     | módulo clínica (futuro)                          | `sislac_consulta_confirmacao`         |
| Cadastro de lead / 2FA                | `leads-manager` (já existente, será migrado)     | `sislac_otp_cadastro`                 |

Cada evento publica um `outbox_item` em vez de chamar `whatsapp-send` diretamente.

---

## 4. Número único corporativo

- Conta **WhatsApp Business SISLAC** (Meta Business Manager).
- 1 `phone_number_id`, 1 `access_token` de longa duração, 1 `webhook_url`, 1 `verify_token`.
- Credenciais armazenadas em **Supabase Vault** (não em `tenant_whatsapp_config`).
- O remetente é sempre o mesmo número; a identidade do laboratório aparece em `{{1}}` do template.
- Pacientes adicionam **um único contato** ("SISLAC") e recebem mensagens de qualquer laboratório por ele.

Vantagens: 1 verificação de marca, 1 quality rating, 1 limite Meta por tier, e suporte unificado.

---

## 5. Opt-out

Tabela planejada `whatsapp_opt_out`:

```text
telefone (E.164) | tenant_id (NULL = global) | motivo | origem | criado_em
```

Regras:
- Paciente responde **`SAIR`** / `STOP` / `CANCELAR` → webhook insere opt-out **global**.
- Paciente pode pedir opt-out por laboratório no portal → opt-out **por tenant**.
- Antes de enfileirar, o despachante checa `whatsapp_opt_out` (global OR tenant) e descarta o envio com motivo `opted_out`.
- Templates `AUTHENTICATION` (OTP) ignoram opt-out por exigência de segurança (documentado).
- Toda mensagem `UTILITY` carrega rodapé "Responda SAIR para não receber".

---

## 6. Retry

Política de retentativas no `whatsapp_outbox`:

| Tentativa | Espera         |
|-----------|----------------|
| 1         | imediata       |
| 2         | +1 min         |
| 3         | +5 min         |
| 4         | +30 min        |
| 5         | +2 h           |

- Backoff exponencial com jitter.
- Erros **permanentes** da Meta (token inválido, template rejeitado, número inválido, opt-out) → `status=failed_permanent`, sem retry.
- Erros **transientes** (HTTP 5xx, rate limit 429, timeout) → re-enfileira até `max_attempts=5`.
- Worker idempotente por `idempotency_key` (já existente em `whatsapp_mensagens`).

---

## 7. Auditoria

Camadas:

1. **`whatsapp_outbox`** — toda intenção de envio (payload, template, variáveis, status, tentativas).
2. **`whatsapp_mensagens`** — registro do envio efetivo (já existe; mantém `message_id`, `status`, `erro`, `payload`).
3. **Webhook** (`whatsapp-webhook`) — eventos `sent / delivered / read / failed` ligados por `message_id`.
4. **`audit_logs`** — alterações em templates, credenciais, opt-out e rate limits (quem/quando/o quê).
5. **Métricas agregadas** em `whatsapp_metrics_tenant` (envios por dia, taxa de entrega, taxa de leitura, falhas por motivo).

Todo acesso a tokens passa por edge function com `service_role`; cliente nunca lê o Vault.

---

## 8. Fila (outbox)

Tabela planejada `whatsapp_outbox`:

```text
id • tenant_id • template_nome • template_versao • idioma
destino_telefone • variaveis(jsonb) • botoes(jsonb)
prioridade • status (pending|sending|sent|failed|failed_permanent|opted_out)
tentativa • proxima_tentativa_em
idempotency_key • criado_por • criado_em • atualizado_em
message_id • erro
```

Despachante:
- Edge function `whatsapp-dispatcher` agendada (cron a cada 30 s).
- Lê N itens `pending` ou `proxima_tentativa_em <= now()` com `SELECT ... FOR UPDATE SKIP LOCKED`.
- Aplica rate limit por tenant e global.
- Chama Meta Graph API com credenciais do Vault.
- Atualiza outbox + insere em `whatsapp_mensagens`.

Produtores (atendimento, resultados, orçamento etc.) apenas fazem `INSERT` na outbox — desacoplados da Meta.

---

## 9. Migração dos tenants

Plano em 4 ondas, **sem downtime**:

1. **Onda 0 — Infra (Fase 3a):** criar `whatsapp_templates`, `whatsapp_outbox`, `whatsapp_opt_out`, `whatsapp_metrics_tenant`, Vault, dispatcher e templates Meta aprovados. Nada disparado ainda.
2. **Onda 1 — Sombra:** novos envios escrevem na outbox em paralelo ao fluxo atual; dispatcher executa em **dry-run** (não chama Meta). Comparação de payloads.
3. **Onda 2 — Piloto:** 1–2 laboratórios marcados como `modo='centralized'`. Dispatcher passa a enviar de fato por esses tenants. Demais continuam em `simples/cloud_api/zapi`.
4. **Onda 3 — Rollout:** flip gradual de `modo` por lote de tenants, com monitoria de entrega/qualidade. Super Admin controla o flag.
5. **Onda 4 — Desativação:** quando 100% migrado, `tenant_whatsapp_config` vira somente-leitura e os campos de token são purgados do Vault legado.

Critério de promoção entre ondas: taxa de entrega ≥ 98% e zero erros permanentes não tratados por 72 h.

---

## 10. Retrocompatibilidade

Durante toda a migração:

- Os três modos atuais (`simples`, `cloud_api`, `zapi`) continuam funcionando.
- `whatsapp-send` permanece deployado e atende tenants ainda **não** migrados.
- Novos produtores escrevem **sempre** na outbox; um adaptador interno decide se o despacho vai pela rota nova (centralizada) ou pela rota antiga (`whatsapp-send`), com base no `modo` do tenant.
- Schema de `whatsapp_mensagens` é preservado; apenas ganha FK opcional para `whatsapp_outbox.id`.
- Nenhuma remoção de tabela, função ou template existente nesta fase nem na Fase 3.
- `leads-manager` (OTP global) é o primeiro consumidor do template `sislac_otp_cadastro` — prova de fogo da rota centralizada.

---

## 11. Plano da Fase 3

**Fase 3 — Implementação Centralizada (resumo, sem código aqui):**

1. **3a — Infraestrutura**
   - Migrations: `whatsapp_templates`, `whatsapp_outbox`, `whatsapp_opt_out`, `whatsapp_metrics_tenant` (com RLS + GRANTs).
   - Mover credenciais corporativas para Vault.
   - Edge function `whatsapp-dispatcher` (cron) + `whatsapp-template-sync` (cataloga templates aprovados na Meta).
2. **3b — Templates**
   - Submeter os 8 templates à Meta.
   - Painel Super Admin: CRUD de templates, status de aprovação, preview com `{{1}}`.
3. **3c — Produtores**
   - Substituir chamadas diretas a `whatsapp-send` por `enqueue(tenant, template, vars)` nos pontos: atendimento finalizado, resultado liberado, orçamento, recoleta, agendamento.
4. **3d — Opt-out e webhook**
   - Estender `whatsapp-webhook` para capturar `STOP/SAIR` e status `delivered/read/failed`.
   - Página pública de opt-out + checagem em todo enqueue.
5. **3e — Central de Notificações (Super Admin)**
   - Dashboard: envios/dia, taxa de entrega, falhas por motivo, opt-outs, rate limits, status dos templates.
   - Filtros por tenant; ações: reprocessar, cancelar, ver payload.
6. **3f — Migração**
   - Executar Ondas 1 → 4 conforme seção 9.
7. **3g — Limpeza (Fase 4, futura)**
   - Depreciar `tenant_whatsapp_config` (campos de token) e remover modo `zapi` quando uso = 0.

---

## 12. Regra de parada

Documento concluído. **Nenhuma** tabela, template, edge function, webhook ou configuração foi alterada nesta fase. Aguardando aprovação para iniciar a **Fase 3**.
