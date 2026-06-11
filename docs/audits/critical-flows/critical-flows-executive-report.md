# Critical Flows — Executive Report

> **Audit scope:** ResultadoDetalhe · Financeiro · SuperAdminTenantDetalhe · Portal do Paciente · WhatsApp/Z-API
> **Mode:** Strictly read-only. No source, migration, RLS, edge function, or DB change was performed.
> **Date:** 2026-06-11
> **Methodology:** 5 parallel specialist agents (Architect, Lab PO, React, Supabase, QA, UX, Security) producing 30 evidence-based reports under `docs/audits/critical-flows/`.

---

## 1. Deliverables index

Every claim in this report is backed by file:line evidence in the per-flow markdown files.

| Phase | Folder | Files |
|---|---|---|
| 1. Dependency map | `dependency-map/` | `resultado-detalhe`, `financeiro`, `super-admin`, `portal-paciente`, `whatsapp-zapi` |
| 2. Business rules | `business-rules/` | idem |
| 3. Complexity / duplication | `complexity/` | idem |
| 4. Risk analysis | `risk/` | idem |
| 5. UX operacional | `ux/` | idem |
| 6. Single source of truth | `ssot/` | idem |
| 7. **Executive synthesis** | this file | — |

---

## 2. Per-module verdict matrix

| Question | ResultadoDetalhe | Financeiro | SuperAdmin/Tenant | Portal Paciente | WhatsApp/Z-API |
|---|---|---|---|---|---|
| Lógica de negócio correta? | **SIM** (com gaps clínicos pontuais) | **SIM** (com 1 fonte de preço divergente) | **SIM** (com gaps de enforcement) | **SIM** | **SIM** |
| Pronto para produção? | **SIM** (operacional) | **SIM** | **PARCIAL** (P0s de segurança) | **PARCIAL** (rate-limit + URL expiry) | **SIM** |
| Existe risco crítico? | **SIM** (clínico) | **SIM** (cobrança/integridade) | **SIM** (segurança) | **SIM** (segurança/LGPD) | NÃO |
| Existe dívida técnica relevante? | **SIM** (2.619 linhas) | **SIM** (2.392 linhas) | **SIM** (1.160 linhas) | NÃO | NÃO |
| Refatoração urgente? | NÃO | NÃO | NÃO | NÃO | NÃO |
| Risco financeiro? | NÃO | **SIM** | indireto | NÃO | NÃO |
| Risco clínico? | **SIM** | NÃO | NÃO | indireto (PDF expira) | NÃO |
| Risco de segurança? | baixo | baixo | **SIM** | **SIM** | médio (credenciais em claro) |
| Risco multi-tenant? | NÃO | médio | **SIM** | médio | NÃO |
| Nível de maturidade | **Avançado** | **Avançado** | **Intermediário** | **Intermediário** | **Avançado** |

---

## 3. Top findings (P0 / P1) — consolidados das 5 análises

> Itens listados **apenas** como diagnóstico. Nenhuma correção foi feita.

### 3.1 P0 — Clínico (ResultadoDetalhe)
- **Bypass de valores críticos no "Liberar Todos"** — `ResultadoDetalhe.tsx:629–677` libera em lote sem chamar `getParametrosCriticosDoExame` nem `CriticoConfirm`. Resultados fora de faixa segura podem ser liberados sem notificação médica.
- **Liberação de dado não salvo** — fluxo `executarLiberacao` (linha ~592) não força `handleSalvar` prévio; estado local digitado pode não ir ao DB e o `finalizado` carimba a versão antiga.

### 3.2 P0 — Financeiro
- **Cobrança incorreta no caminho legado de A-Receber** — `Financeiro.tsx:264-268` recalcula `valorTotalPaciente` ao vivo via `getPrecoExame`. Se a tabela de preço muda após o atendimento, o saldo aberto muda. O caminho RPC (`a_receber_pacientes_page`) usa o valor persistido em `atendimento_exames.valor`. **Dois caminhos divergem para o mesmo atendimento.**
- **Cancelamento de fatura não atômico** — `convenioFaturasStore.ts:359-374` faz delete + update em duas chamadas; falha intermitente deixa header `aberta` sem itens.

### 3.3 P0 — SuperAdmin
- **Verificação de role no client** — checagem de `super_admin` em algumas telas é client-side (ver risk-analysis); deve ser revalidada server-side em toda edge function (parcialmente já é via `is_super_admin`).
- **Plaintext secrets em `integration_credentials` / tenant config** — credenciais persistidas sem KMS/at-rest encryption.
- **Magic-link retornado no corpo da resposta** em fluxos administrativos — risco de log/leak.

### 3.4 P0 — Portal do Paciente
- **URL pré-assinada de 1h gravada em shortlink de 24h** (`upload-pdf:165` vs `comprovante-shortlink:87/115`) — paciente abre o link após 1h e recebe erro de acesso ao PDF clínico.
- **OTP de verificação com `Math.random()`** em `leads-manager/index.ts:44` — previsível.
- **Sem rate-limit** em `comprovante-resolve` e `leads-manager` — bruteforce de código de 6 chars e abuso de OTP/WhatsApp.
- **CPF em claro** em `solicitacoes_publicas` (LGPD Art. 5-II).
- **`hostHint` aceito do client** em `comprovante-shortlink` — shortlink pode apontar para domínio do atacante.

### 3.5 P1 — WhatsApp / Z-API
- **Credenciais (access_token, zapi_token) sem criptografia** em `tenant_whatsapp_config`.
- **Sem dedupe / idempotency-key** em `whatsapp-send` — retry pode duplicar envio cobrado.
- **Sem fila assíncrona / DLQ** — picos de liberação em lote disparam HTTP síncrono no thread da edge function.

---

## 4. Dívida arquitetural (sem refatoração agora)

| Arquivo | Linhas | Observação |
|---|---|---|
| `src/pages/ResultadoDetalhe.tsx` | 2.619 | Monolito clínico; helpers já parcialmente extraídos em `ResultadoDetalhe/` |
| `src/pages/Financeiro.tsx` | 2.392 | Duas fontes (legado + RPC) coexistem |
| `src/pages/superadmin/SuperAdminTenantDetalhe.tsx` | 1.160 | N+1 em algumas queries; ações de produção misturadas |

**Decisão registrada:** não fatiar agora — risco regressivo > ganho. Documentar e tratar em sprint dedicada, igual ao padrão aplicado em `/novo-atendimento`.

---

## 5. Single Source of Truth — divergências mapeadas

| Domínio | Fonte de verdade canônica | Divergência detectada |
|---|---|---|
| Preço de exame | `atendimento_exames.valor` (persistido) | `getPrecoExame` recalcula no render do A-Receber legado |
| Plano do tenant | `tenant_subscriptions_billing.plan_code` | `tenants.plano` mantém cópia legada não sincronizada |
| Modo de banco do tenant | `tenant_registry.database_strategy` | `runtime_mode` duplica o conceito |
| PDF do comprovante | objeto no Storage (object_key) | `comprovante_links.url_assinada` grava URL pré-assinada de curta duração |
| Limites de referência clínica | `valores_referencia` + `exame_parametros.valorReferencia` | Dois caminhos resolvem a faixa (sex/idade) com lógicas paralelas |
| Templates WhatsApp | hardcoded no frontend (`comprovantes.ts`) | sem tabela `whatsapp_templates` — alteração exige deploy |

---

## 6. Risco multi-tenant — síntese

- ✅ **RLS server-side via `current_tenant_id()`** está aplicado nas tabelas operacionais.
- ⚠️ Algumas leituras client-side aplicam `.eq("tenant_id", …)` como defesa em profundidade — bom; outras (`fetchEntradasView`) confiam 100% na RLS — aceitável mas vale alinhar padrão.
- ⚠️ Joins em `convenioFaturasStore` (linha ~243) não reaplicam `tenant_id` no join secundário; se RLS falhar, nomes de pacientes de outro tenant podem vazar.
- ✅ Super Admin é role de plataforma e nunca usa `profiles.tenant_id` legado para autorizar — boundary correto.

---

## 7. Escalabilidade — projeção 100 labs / 10k pacientes / 100k atendimentos / 1M mensagens

| Domínio | Veredito | Observação |
|---|---|---|
| ResultadoDetalhe | OK | Render por atendimento; PDF gerado on-demand |
| Financeiro | OK até 100k | A-Receber legado faz cálculo em memória — RPC já existe |
| SuperAdmin | Atenção | listagens sem paginação real em algumas telas |
| Portal Paciente | OK | shortlinks indexados; storage S3-compatible |
| WhatsApp | **NÃO escala** sem fila — envio síncrono na edge function; 1M msgs exige worker assíncrono e DLQ |

---

## 8. Conclusão executiva

```text
Como cada fluxo realmente funciona?
→ Documentado em 30 relatórios sob docs/audits/critical-flows/ com evidências file:line.

Ele continuará seguro, simples e sustentável pelos próximos anos?
→ Sim, com 3 condições não-urgentes mas obrigatórias:
   1. Tratar P0s clínicos (bypass crítico) e financeiros (cobrança divergente).
   2. Endurecer Portal do Paciente (rate-limit, OTP cripto, URL regenerada).
   3. Mover envio WhatsApp para fila antes de escalar para 1M msgs/mês.

Nenhuma refatoração estrutural é exigida agora.
Arquitetura SaaS multi-tenant, RPCs transacionais, RLS por current_tenant_id()
e edge functions com tenantGuard formam uma base sólida.
```

---

## 9. Stop rule cumprida

- Nenhum código foi alterado.
- Nenhuma migration criada.
- Nenhuma RLS/Edge Function tocada.
- Nenhum banco modificado.
- Apenas 31 arquivos markdown criados sob `docs/audits/critical-flows/`.
