# SISLAC — RPC Audit (Phase 6)

**Data:** 2026-06-15. Somente leitura. Base: `_inventory-rpcs.txt` (151 funções no schema `public`).

Convenção de tipos:
- **Helper de autorização** — SECURITY DEFINER, retorno bool/uuid.
- **Trigger function** — invocada por trigger.
- **Domain RPC** — chamada por frontend/edge function como transação.
- **Util** — pura, sem efeito.

---

## 1. Helpers de autorização (SSOT — manter)

| Função | Uso | Veredito |
|---|---|---|
| `current_tenant_id()` | 200+ policies | 🟢 manter |
| `current_tenant_id_strict()` | RPCs operacionais | 🟢 manter |
| `is_super_admin(uuid)` | policies + edge functions | 🟢 manter |
| `has_role(uuid, app_role)` | policies | 🟢 manter |
| `has_permission(uuid, text)` | policies | 🟢 manter |
| `is_post_finalizacao(bigint)` + `_is_post_finalizacao(bigint)` | guards | 🟡 **duplicado** — versão `_` é interna SQL; pública chama `_`. Confirmar; possível merge. |

---

## 2. Domain RPCs — principais

| Função | Responsabilidade | Risco |
|---|---|---|
| `create_atendimento_tx` | cria atendimento + exames + pagamentos | 🟡 gigante (centenas de linhas, múltiplas responsabilidades). Documentado em `docs/audits/novo-atendimento/*` e em `docs/audits/laravel-vs-lovable-comparativo.md §3.4` — candidato a quebra em steps `[Validate, Price, Persist, Invoice, Audit, Notify]`. |
| `update_atendimento_tx` | edita atendimento | 🟡 espelho de `create_*` |
| `registrar_pagamento_tx` | grava pagamento + recalcula saldo | 🟢 escopo claro |
| `estornar_pagamento_tx` | estorno | 🟢 |
| `criar_fatura_convenio_tx` | gera fatura | 🟢 |
| `atendimento_assign_protocolo` (trigger) | atribui protocolo | 🟢 |
| `atendimento_exames_rbac_check` (trigger) | bloqueia transições | 🟢 |
| `atendimento_exames_snapshot_regulatorio` (trigger) | congela snapshot regulatório | 🟢 |
| `aplicar_enriquecimento_exame` | enriquecimento por TUSS/CBHPM | 🟢 |
| `a_receber_pacientes_page` | paginação com cursor | 🟢 |

---

## 3. Públicas para `anon` (intencional)

- `get_published_tenant_page(slug text)` — devolve página de marketing.
- `lookup_paciente_publico(cpf text, tenant_id uuid)` — devolve só dado mascarado + rate-limited.

**Após hardening 2026-06-15**, `EXECUTE` foi revogado de `PUBLIC`/`anon` para todas as funções **exceto** essas duas. ✅

---

## 4. Triggers / utilitários

- `audit_trigger` — usado em ~50 tabelas. 🟢 manter (SSOT de auditoria).
- `touch_*_updated_at` / `tg_*_updated_at` — ~75 funções, padrão idêntico. 🟡 **alta repetição**.
  Oportunidade P2: 1 função genérica `touch_updated_at()` reutilizada por todas as triggers (já existe em parte; restantes são "snowflake" copy-paste).
- `fwd_*_to_*` (forward de auditoria) — 🟢 manter; volume baixo.
- `recompute_status_*` — 🟢 manter; encapsula regra de domínio.
- `_calc_dv_amostra`, `_get_protocolo_hmac_key`, `_get_audit_justificativa` — helpers internos. 🟢 manter.

---

## 5. RPCs duplicadas / candidatas a consolidação

| Grupo | Funções | Recomendação |
|---|---|---|
| Touch updated_at | `touch_app_settings_updated_at`, `tg_amostras_updated_at`, etc. (~75) | Substituir por `touch_updated_at()` genérica (P2). |
| Audit forwarders | `fwd_app_settings_audit_to_platform`, `fwd_atendimento_audit_to_operational`, … | Manter; é o split intencional plataforma vs operacional. |
| `is_post_finalizacao` / `_is_post_finalizacao` | 2 versões | Validar necessidade de wrapper público SQL (P3). |

---

## 6. RPCs gigantes (responsabilidade excessiva)

| Função | Por que é grande | Recomendação |
|---|---|---|
| `create_atendimento_tx` | valida + precifica + persiste + fatura + auditoria + notifica | Pipeline explícito (P1, ver `docs/architecture/coremas-lessons-applied.md §3.4`). |
| `update_atendimento_tx` | espelha o create | Mesmo refator. |

**Não fazer agora** — refator estrutural, requer plano dedicado.

---

## 7. RPCs sem uso aparente

Verificação cruzada com `rg` em `src/` e `supabase/functions/` ainda não foi exaustiva. Candidatas óbvias (sem hit aparente):
- Nenhuma identificada com confiança nesta rodada. Sweep completo exige `pg_stat_user_functions` + análise estática — adiado.

---

**Fim Fase 6.** Nada alterado.
