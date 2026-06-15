# SISLAC — Domain Security Map (Phase 2)

**Data:** 2026-06-15. Somente leitura.

Pergunta-guia em cada domínio: *quem pode ler / criar / alterar / excluir?*
Resposta é a interseção de:

1. **Tenant gate** — `tenant_id = current_tenant_id()` (server-side, via JWT) *ou* `is_super_admin(uid)`.
2. **Role gate** — `has_role(uid, 'admin'|'manager'|'user')` (tabela `user_roles`, SECURITY DEFINER).
3. **Permission gate** — `has_permission(uid, '<perm>')` (matriz declarada por role).

> Para super-admin todas as operações destrutivas passam por **edge function** com `service_role` + revalidação `is_super_admin` no servidor. RLS apenas dá visibilidade de leitura.

---

## 1. Pacientes (`pacientes`)

| Ação | Quem | Por quê |
|---|---|---|
| Read | super_admin OU (mesmo tenant E perm `visualizar_atendimentos` ou `criar_atendimento`) | recepção + atendimento |
| Create | mesmo tenant E perm `cadastrar_paciente` ou `criar_atendimento` | cadastro durante atendimento |
| Update | mesmo tenant E perm `cadastrar_paciente` ou `editar_atendimento` | correção de cadastro |
| Delete | mesmo tenant E `admin` | manutenção administrativa |

Endpoint público `lookup_paciente_publico` retorna apenas `(id, nome_mascarado, possui_resultado)` com rate-limit (`public_rate_limits`).

---

## 2. Atendimentos (`atendimentos`, `atendimento_exames`, `atendimento_pagamentos`, `amostras`, `recoletas`)

| Ação | Quem |
|---|---|
| Read | super_admin OU mesmo tenant + perm `visualizar_atendimentos` (ou subset por subdomínio) |
| Create | mesmo tenant + perm `criar_atendimento` |
| Update | mesmo tenant + perm `editar_atendimento`/`registrar_coleta`/`analisar_amostra`/`liberar_resultado` (granular por etapa) |
| Cancel | mesmo tenant + perm `cancelar_atendimento` |
| Pagamentos | INSERT/UPDATE = perm `registrar_pagamento`; DELETE = `admin` (estornos sensíveis); SELECT inclui `visualizar_financeiro` |

Regra adicional: trigger `atendimento_exames_rbac_check_trg` bloqueia transições inválidas (defesa em profundidade complementar ao policy).

---

## 3. Resultados (`atendimento_exames` campos `resultado_*`, `resultados_entregas`, `criticos_comunicacoes`)

| Ação | Quem |
|---|---|
| Lançar resultado | perm `analisar_amostra` |
| Liberar (assinatura) | perm `liberar_resultado` (analista validado por `validarCredenciaisAnalista` com `has_role` server-side) |
| Retificar | perm `retificar_resultado` (gera `pdf_override_audit`) |
| Crítico — registrar comunicação | perm `registrar_critico` |
| Entrega ao paciente | perm `entregar_resultado` |
| Leitura por paciente | via portal público (`solicitacoes_publicas` + OTP + `identidade_confirmacoes`) — escopo limitado ao próprio CPF/protocolo |

---

## 4. Financeiro (`convenio_faturas`, `convenio_fatura_itens`, `financeiro_saidas`, listas)

| Ação | Quem |
|---|---|
| Read | perm `visualizar_financeiro` |
| Create / Update | perm `editar_financeiro` |
| Delete | `admin` |
| Listas (formas/destinos/tipos) | leitura por qualquer user do tenant; escrita por `admin` |
| Gateways de pagamento (`tenant_payment_gateways`) | **APENAS** `admin`/`manager` leem; **apenas** `admin` escreve (hardening 2026-06-15) |

Lembrete: "Entradas" no UI são read-only e derivadas de `atendimento_pagamentos` (ver `mem://features/financeiro/integridade-de-entradas`).

---

## 5. Portal paciente (`solicitacoes_publicas`, `exames_publicos`, `inscricoes`, `comprovante_links`)

| Ação | Quem |
|---|---|
| `solicitacoes_publicas` insert (paciente solicita) | edge function pública com rate-limit |
| Leitura por paciente | OTP + `identidade_confirmacoes` (TTL 5 min, 5 tentativas) |
| `inscricoes` (signups SaaS) | **bloqueado para anon** desde hardening 2026-06-15 — apenas via edge function `leads-manager`; super_admin lê via tela |
| `comprovante_links` | shortlink + token; resolução via edge function `comprovante-resolve` |
| `exames_publicos` | leitura aberta (catálogo de marketing por tenant) |

---

## 6. WhatsApp (`whatsapp_mensagens`, `tenant_whatsapp_config`)

| Ação | Quem |
|---|---|
| Read mensagens | perm `visualizar_atendimentos` (mesmo tenant) |
| Send | edge function `whatsapp-send` (idempotência SHA-256 + rate-limit) — chamada por `admin`/`manager` |
| Config | `admin` apenas; segredos em `integration_credentials` cifrados |
| Webhook recebido | `whatsapp-webhook` (público, valida assinatura HMAC do provedor) |

---

## 7. Super-Admin (control plane)

Roles na tabela `user_roles`:
- `super_admin` — **plataforma**, fora de tenant.
- `admin`, `manager`, `user` — escopo do tenant.

Toda operação CORE (criar/atualizar/deletar tenant, mudar plano, impersonar, backup, resetar senha) executa via edge function `super-admin-*`, que:

1. Lê JWT do caller.
2. Re-valida `rpc('is_super_admin')` server-side.
3. Usa `service_role` apenas após validar.
4. Registra em `platform_audit` / `tenant_provision_audit`.

**Anti-escalation:** policy de `user_roles` proíbe um não-super_admin de inserir/atualizar linha com `role='super_admin'` (hardening 2026-06-15).

---

## 8. Quadro síntese de perfis

| Role | Lê tenant alheio? | Cria atendimento? | Altera financeiro? | Configura integração? | Gere usuários? |
|---|:-:|:-:|:-:|:-:|:-:|
| `super_admin` | ✅ (via funções) | ❌ (não opera tenant) | ❌ | ❌ (config do tenant é do tenant) | ✅ (provisão) |
| `admin` (tenant) | ❌ | ✅ | ✅ | ✅ | ✅ (dentro do tenant) |
| `manager` | ❌ | ✅ | ✅ (sem deletar) | ✅ (ver) | ❌ |
| `user` (recepção/analista) | ❌ | ✅ (perm) | ❌ ou só `registrar_pagamento` | ❌ | ❌ |

---

**Fim Fase 2.** Nada alterado.
