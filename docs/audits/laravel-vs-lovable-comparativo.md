# SISLAC Laravel vs SISLAC Lovable — Análise Comparativa e Recomendações

**Data:** 2026-06-11
**Escopo:** somente leitura — código Laravel (`/tmp/coremas`) e dump `u444904474_coremas.sql` (52 tabelas, 514 statements) comparados ao SISLAC Lovable atual (React + Supabase, ~90 tabelas, multi-tenant + RLS).
**Regra:** nenhuma alteração de código foi feita. Este documento é diagnóstico.

---

## 1. O que o Laravel acertou (e por que parece "perfeito")

| # | Acerto | Evidência no dump |
|---|--------|-------------------|
| L1 | **Domínio enxuto.** 52 tabelas, sem multi-tenant, sem RLS, sem cifragem. Tudo single-DB. | `appointments`, `appointment_exams`, `results`, `exams`, `new_parameter`, `exam_filters`, `routine_traceabilities`, `invoices`, `invoice_details`, `transactions` — fim. |
| L2 | **Modelo central simples e bem nomeado.** Um `appointment` → N `appointment_exams` → N `results`. Status numéricos (`0=pending,1=complete,2=cancel`) documentados na própria coluna. | `appointments.status COMMENT '0=>pending,1=>complete,2=>cancel'` |
| L3 | **Pipeline claro de criação** (`store→save→check→finish→show→print`) implementado como Laravel Pipeline. Cada estágio é uma classe pequena. | `app/Http/Pipes/AppointmentPipes/*` |
| L4 | **Parâmetros do exame em UMA tabela** (`new_parameter`) com TODAS as regras (tipo, máscara, mínimo, máximo, fórmula, obrigatório, bloqueio crítico, régua de impressão). Sem distribuir regra em 4 tabelas. | `new_parameter` (28 colunas auto-suficientes) |
| L5 | **Filtros etários por exame em UMA tabela** (`exam_filters`) com (sex, intial/final age year/month/day). Resolve referência clínica num único `JOIN`. | `exam_filters` |
| L6 | **Rastreabilidade simples**: `routine_traceabilities (appointment_id, exam_id, stage_id, user_id, registered_at)` cobre 100% do histórico. Não há tabela paralela de "audit". | `routine_traceabilities` |
| L7 | **Faturamento direto**: `invoices` 1:1 com `appointment`, `invoice_details` para itens, `transactions` para pagamentos. Três tabelas resolvem todo o financeiro. | `invoices`, `invoice_details`, `transactions` |
| L8 | **Helpers triviais reaproveitáveis**: `Fill`, `Date`, `Sanitize`. Nada de "store global + cache + realtime + feature flag". | `app/Helpers/*` |
| L9 | **Soft delete por flag** (`is_deleted tinyint`). Não usa o `SoftDeletes` do Eloquent — explícito demais é melhor que mágico. | quase todas as tabelas |
| L10 | **PDF de laudo numa única trait** (`ContentPdf`, ~1.000 linhas, TCPDF). Sem 6 caminhos diferentes de impressão. | `app/Traits/ContentPdf*` |

> **Resumo do "porquê parece perfeito":** o Laravel resolve **um** laboratório, com **uma** equipe, sem isolamento de dados, sem cifragem, sem auditoria fina, sem realtime, sem integração externa, sem rate-limiting, sem OTP, sem portal do paciente, sem WhatsApp. **Domínio < complexidade**, então a relação domínio/código é 1:1.

---

## 2. Por que o Lovable é mais complexo (e quando isso é justificado)

| Eixo | Laravel | Lovable | Justificativa do delta |
|------|---------|---------|------------------------|
| Tenancy | 1 lab fixo | N labs multi-tenant via RLS + `current_tenant_id()` | Produto SaaS. **Justificado e inevitável.** |
| Auth | Sentinel + `permissions text` no `users` | Supabase Auth + `user_roles` separado + `has_permission` | Segurança real (sem privilege escalation). **Justificado.** |
| Auditoria | `routine_traceabilities` (1 tabela) | `routine_traceabilities` + `atendimento_audit` + `audit_logs` + `protocolo_auditoria` + `app_settings_audit` + `pdf_override_audit` + `storage_audit` + `tenant_provision_audit` + `subscription_changes_log` + `tenant_migration_log` | **Excessivo** — ver §3. |
| Status de atendimento | 3 valores (`0/1/2`) | 7+ status derivados em vários pontos | **Excessivo** — ver §3. |
| Parâmetros do exame | 1 tabela (`new_parameter`) | `exame_parametros` + `valores_referencia` + `reguas_etarias` + `exame_layouts` + `exame_pops` + `tuss_catalogo` | Parcialmente justificado (referência por convênio), mas fragmentado. Ver §3. |
| Integração externa | `integracao` (4 colunas, vazia) | `integrations` + `integration_credentials` + `integration_logs` + `integration_jobs` + `integration_dead_jobs` + `integration_exam_map` + `integration_pdfs` + `integration_provider_*` + `integration_requests` + `integration_responses` + `integration_results` + `integration_sync_state` (13 tabelas) | Justificado — Hermes/DBSync existem de verdade. |
| Financeiro | 3 tabelas | `atendimento_pagamentos` + `convenio_faturas` + `convenio_fatura_itens` + `financeiro_saidas` + `financeiro_destinos_pagamento` + `financeiro_formas_pagamento` + `financeiro_tipos_despesa` | Justificado (particular + convênio + saídas + faturamento). |
| WhatsApp | inexistente | `whatsapp_mensagens` + `tenant_whatsapp_config` + idempotency + rate-limit | Justificado, mas ver §3. |
| Portal paciente | inexistente | `inscricoes` + OTP + `resultados_entregas` + shortlinks + `public_rate_limits` | Justificado (LGPD). |
| Tabelas no schema `public` | 52 | **~90** | Crescimento natural do produto, mas duplicação real existe. |

---

## 3. O que dá para SIMPLIFICAR no Lovable inspirado no Laravel

Os pontos abaixo são **oportunidades reais**, não defeitos bloqueantes. Cada um cita o ganho concreto e o risco da mudança. **Nenhum é P0** — o sistema atual funciona; trata-se de redução de complexidade sustentável.

### 3.1 Unificar parâmetros do exame (estilo `new_parameter`)
- **Hoje (Lovable):** regra de cada parâmetro vive em `exame_parametros` (tipo/máscara/obrigatório), `valores_referencia` (faixas), `reguas_etarias` (idade), `criticoChecker.ts` (bloqueio crítico) e ainda em helpers de UI.
- **Laravel:** tudo em `new_parameter` (incluindo `block_recording`, `minimum`, `maximum`, `formula`, `mandatory_parameter`, `imp_ruler`, `decimal_places`).
- **Recomendação:** manter `valores_referencia` separado (faz sentido — varia por sex/idade/convênio), mas **consolidar máscara/obrigatório/bloqueio crítico em `exame_parametros`** e expor um único helper `getParamRules(parametroId)` como SSOT.
- **Risco:** baixo. É refactor de leitura.

### 3.2 Reduzir o número de tabelas de auditoria
- **Hoje:** 10 tabelas de auditoria distintas. Documentação fica espalhada, a UI de auditoria precisa de 10 leitores diferentes, e quando o usuário pergunta "o que aconteceu com este atendimento?" a resposta exige `UNION` de 4 fontes.
- **Laravel:** 1 tabela (`routine_traceabilities`) faz o trabalho de 80% dos casos.
- **Recomendação:** definir **2 tabelas de auditoria** apenas — uma operacional (eventos de atendimento/exame/resultado) e uma de plataforma (super-admin, billing, cifragem). Manter as 10 atuais como views compatíveis durante migração.
- **Risco:** médio. Exige migração de dados históricos.

### 3.3 Status do atendimento como **uma** máquina de estados
- **Hoje:** status do atendimento é derivado em 5+ pontos do código (frontend store, helpers do financeiro, helpers do resultado, helpers de coleta). A memória do projeto já registra "Automação de Status", mas a derivação ainda está espalhada.
- **Laravel:** `appointments.status` é um inteiro, e cada transição é um método do controller. Não há derivação.
- **Recomendação:** criar **um único reducer puro** `deriveAtendimentoStatus(atendimento, exames, pagamentos)` em `src/lib/atendimentoStatus.ts` e usar **só esse** em toda a aplicação. (Já existe parcialmente em `atendimentoStore.ts` — falta consolidar.)
- **Risco:** baixo. Refator de fonte única.

### 3.4 Pipeline explícito para criação de atendimento (estilo Laravel Pipes)
- **Hoje:** `NovoAtendimento` foi simplificado para página única, mas a finalização ainda mistura: cálculo de preço + persistência + geração de protocolo + criação de fatura + log de auditoria + dispatch WhatsApp.
- **Laravel:** `AppointmentPipes/{Store,Save,Check,Finish,Show,Print}` — cada etapa é uma classe pequena, testável isolada, fácil de reordenar.
- **Recomendação:** quebrar `create_atendimento_tx` (RPC) em **steps nomeados** dentro de uma única transação, expondo um array `[Validate, Price, Persist, Invoice, Audit, Notify]`. Mantém a transação atômica, mas ganha rastreabilidade e testes unitários por step.
- **Risco:** médio. Mexe em RPC crítica.

### 3.5 Consolidar tabelas de configuração de "select"
- **Hoje:** `select_options`, `motivos_cancelamento`, `recoletas_motivos`, `financeiro_tipos_despesa`, `financeiro_destinos_pagamento`, `financeiro_formas_pagamento` são todas essencialmente **listas chave-valor por tenant**.
- **Laravel:** usa enums PHP (`StatusEnum`, `StageEnum`, `MotiveEnum`) — zero tabelas.
- **Recomendação:** manter as tabelas onde o tenant precisa editar, mas mover para `select_options` (que já existe) com `categoria` discriminadora. Reduz 5 tabelas para 1.
- **Risco:** médio. Migração de dados + ajuste de UIs de configuração.

### 3.6 Faturamento mais parecido com `invoices/invoice_details/transactions`
- **Hoje:** cobrança particular usa `atendimento_pagamentos` (uma linha por recebimento) e cobrança convênio usa `convenio_faturas + convenio_fatura_itens`. **Dois modelos distintos** para o mesmo conceito ("fatura com itens e recebimentos").
- **Laravel:** `invoices + invoice_details + transactions` cobre **ambos** os fluxos com a mesma estrutura.
- **Recomendação:** unificar conceitualmente em `faturas + fatura_itens + fatura_recebimentos`, com `tipo IN ('particular','convenio')`. Mantém compatibilidade com leitura atual via views.
- **Risco:** alto. Refator estrutural — só fazer com janela de manutenção planejada.

### 3.7 Helpers simples no estilo Laravel (`Fill`, `Date`, `Sanitize`)
- **Hoje:** o Lovable tem ~50 arquivos em `src/lib/` (muitos com 200+ linhas) e helpers de formatação espalhados em `src/data/*` e componentes.
- **Laravel:** 3 helpers cobrem tudo.
- **Recomendação:** consolidar formatação (CPF, telefone, data, idade, moeda, NFD) em `src/lib/format.ts` único e proibir reimplementação em componente (lint rule). Reduz inconsistências de exibição.
- **Risco:** baixo. Codemod simples.

### 3.8 Manter o que o Lovable faz melhor (não copiar Laravel aqui)
Estes pontos o Lovable acerta e **não** devem ser simplificados:

- **RLS + `current_tenant_id()`** em todas as tabelas de domínio — o Laravel não tem isolamento; isso é regressão de segurança grave em SaaS.
- **`user_roles` separado** com `has_role` SECURITY DEFINER — o Laravel usa `users.permissions text` (vulnerável a privilege escalation).
- **OTP do portal do paciente com `crypto.getRandomValues` + TTL + tentativas** (P0 #2 já resolvido) — o Laravel não tem portal.
- **Idempotência de WhatsApp por SHA-256 + índice único** (P0 #4 já resolvido) — o Laravel não tem WhatsApp.
- **Rate-limit em endpoints públicos** (P0 #3 já resolvido) — o Laravel só roda intranet.
- **`appointments.access_key varchar(8)`** do Laravel é um shortlink **inseguro** (8 chars sem rate-limit) — o Lovable já resolveu isso melhor com `comprovante_links`.

---

## 4. Riscos do Laravel que o Lovable já evita

| Risco no Laravel | Como o Lovable já mitigou |
|------------------|---------------------------|
| `users.permissions text` (string serializada) | `user_roles` + enum `app_role` |
| `payment_apis.key/secret` em **plaintext** | `integration_credentials` com `password_encrypted` + AES-GCM (P0 #5 residual) |
| Sem isolamento entre clientes | RLS + `tenant_id NOT NULL` em todas as tabelas |
| `access_key varchar(8)` sem rate-limit no comprovante | `comprovante_links` + `public_rate_limits` |
| Sem OTP/2FA no portal | OTP 6 dígitos + TTL 5 min + 5 tentativas |
| `is_deleted tinyint` ao invés de FK constraints | FK reais + RLS bloqueia leitura |
| Charset misto (`utf8mb3` em `exam_models`, `utf8mb4` no resto) | Postgres UTF-8 uniforme |
| Sem migrations versionadas para alterações de dados | `supabase/migrations/*.sql` versionadas |

---

## 5. Plano de simplificação recomendado (em ordem de ROI)

| # | Ação | Impacto | Esforço | Risco |
|---|------|---------|---------|-------|
| S1 | Reducer único `deriveAtendimentoStatus` (§3.3) | Alto — elimina divergência de status entre telas | 1-2 dias | Baixo |
| S2 | `src/lib/format.ts` único + lint (§3.7) | Médio — consistência visual | 1 dia | Baixo |
| S3 | SSOT de parâmetros do exame (§3.1) | Alto — simplifica `ResultadoDetalhe` | 3-5 dias | Baixo-médio |
| S4 | Consolidar selects em `select_options` (§3.5) | Médio — reduz 5 tabelas | 3 dias | Médio |
| S5 | Steps explícitos em `create_atendimento_tx` (§3.4) | Médio — testes e debug | 3-5 dias | Médio |
| S6 | 2 tabelas de auditoria + views compat (§3.2) | Alto — UI de auditoria viável | 1 semana | Médio |
| S7 | Unificar faturas particular/convênio (§3.6) | Alto — modelo financeiro coerente | 2 semanas | Alto |

> **Recomendação executiva:** executar S1+S2+S3 nas próximas 2 sprints (alto ROI, baixo risco). Avaliar S4/S5/S6 depois. **Adiar S7** — alto valor, mas exige janela de manutenção e migração de dados históricos.

---

## 6. Veredito final

- O Laravel **não é mais profissional** — é **mais simples** porque resolve **menos problema**. Single-tenant, sem cifragem, sem auditoria fina, sem OTP, sem WhatsApp, sem integração externa, sem rate-limit, sem portal do paciente.
- O Lovable **carrega complexidade essencial** (multi-tenant SaaS + LGPD + integrações + portal) que **não pode ser removida sem perder produto**.
- Mas o Lovable também carrega **complexidade acidental** (10 tabelas de auditoria, status derivado em 5 lugares, parâmetros fragmentados em 4 tabelas, dois modelos de fatura). **Essa é removível** — §3 lista como.
- O design do Laravel ensina **uma única lição central**: **prefira uma tabela rica a quatro tabelas magras quando o domínio for o mesmo**. `new_parameter`, `exam_filters` e `routine_traceabilities` são exemplos perfeitos.

**Classificação:** SISLAC Lovable está **arquiteturalmente correto para SaaS**, mas **acima do necessário em granularidade interna**. As 7 simplificações de §5 reduziriam ~25% da superfície de código sem perda funcional.

---

**Fim do relatório. Nenhum código alterado.**
