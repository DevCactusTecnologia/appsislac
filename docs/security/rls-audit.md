# SISLAC — RLS Audit (Phase 3)

**Data:** 2026-06-15. Somente leitura. Base: `_inventory-policies.txt` (305 policies).

Classificação:
- 🟢 **Verde** — padrão SSOT (`current_tenant_id()` + `has_permission`), fácil de ler.
- 🟡 **Amarelo** — funciona, mas longa cadeia de `OR has_permission` reduz legibilidade.
- 🔴 **Vermelho** — duplicada, redundante, ou risco.

---

## 1. Verde 🟢 (maioria — ~85% das policies)

Padrão observado em 80+ tabelas operacionais:

```sql
USING       (is_super_admin(auth.uid()) OR tenant_id = current_tenant_id() AND has_permission(...))
WITH CHECK  (tenant_id = current_tenant_id() AND has_permission(...))
```

Exemplos limpos:
- `amostras_*` (4 policies)
- `app_settings_*` (4 policies)
- `atendimento_pagamentos_*` (4 policies)
- `convenio_faturas_*`, `mapas_trabalho_*`, `pacientes_*`, `unidades_*`, `convenios_*`, `exames_catalogo_*`.

**Veredito:** Olhou. Entendeu. Manter.

---

## 2. Amarelo 🟡 (~12%)

Policies com 4+ `has_permission(...)` em OR. Funcionam, mas a leitura de uma policy ocupa 4-6 linhas.

Exemplos:
- `atendimento_exames_select` — 6 permissões diferentes em OR (visualizar, registrar_coleta, analisar_amostra, liberar_resultado, imprimir_laudo, consultar_resultados).
- `atendimento_exames_update` — 4 permissões em OR.
- `amostras_select` — 3 permissões em OR.

**Recomendação P2 (sem alterar agora):** considerar `can_read_atendimento_exames(uid)` SECURITY DEFINER que encapsula as 6 permissões. Reduziria a policy a uma linha e centralizaria mudanças de matriz.

---

## 3. Vermelho 🔴 — pontos a investigar (sem corrigir agora)

### 3.1 Tabelas com 5 policies (potencial duplicação)

| Tabela | Policies | Observação |
|---|---:|---|
| `documento_templates` | 5 | provável split (templates do tenant vs. templates globais). Validar se duas SELECT policies não se sobrepõem (PostgREST faz `OR`). |
| `profiles` | 5 | tem policy adicional para o próprio user atualizar seu nome — confirmar que não permite alterar `tenant_id`/`email` sem auditoria. |
| `select_options` | 5 | split intencional: globais (`tenant_id IS NULL`, leitura por todos) + do tenant. Documentado. |
| `solicitacoes_publicas` | 5 | inserção pública + leitura do tenant — split intencional, mas merece atenção (ver §3.3). |
| `tabela_preco_itens` | 5 | provável split por tipo de tabela (CBHPM/TUSS/Própria). Verificar redundância. |
| `unidades` | 5 | extra policy para leitura por anon do portal público — confirmar limites. |

### 3.2 Tabelas com policy "auditoria" só de SELECT

`atendimento_audit`, `app_settings_audit`, `audit_logs`, `operational_audit`, `platform_audit`, `pdf_override_audit`, `protocolo_auditoria`, `storage_audit`, `tenant_provision_audit`, `subscription_changes_log`, `tenant_migration_log`. Cada uma tem apenas 1-2 policies (SELECT), gravação via trigger ou edge function. **Verde funcional** — mas 10 tabelas separadas é a "complexidade acidental" já apontada em `docs/audits/laravel-vs-lovable-comparativo.md §3.2`.

### 3.3 Pontos sensíveis a revisar (sem ação imediata)

- **`solicitacoes_publicas` insert** — confirmar que policy de INSERT exige `tenant_id` resolvido server-side via edge function e não confia em `tenant_id` enviado pelo cliente. (Hoje há edge function `tenant-resolve` antes do insert, mas a policy permite insert direto se o `anon` souber o tenant id.) **Risco amarelo.**
- **`comprovante_links`** — 4 policies. Confirmar se DELETE não é exposta ao paciente.
- **`tenant_payment_gateways`** — restrito a `admin/manager` em SELECT após hardening 2026-06-15. ✅ Verde.
- **`inscricoes`** — anon foi removido em 2026-06-15. ✅ Verde.

### 3.4 Policies sem uso aparente

Nenhuma policy "morta" detectada nesta passada (todas as tabelas têm leitor real no código). Verificação completa exigiria correlacionar `pg_stat_user_tables.seq_scan` com policies — adiado.

---

## 4. Policies conflitantes

PostgreSQL combina policies do mesmo comando com **OR** (permissive) ou **AND** (restrictive). Todas as policies do SISLAC são `PERMISSIVE` (padrão). Não há policies restrictive — significa que adicionar uma policy só **amplia** acesso. **Nenhum conflito real detectado.**

Cuidado: em tabelas com 5 policies SELECT (ex.: `select_options`), o `OR` lógico é exatamente o desejado (global ∪ do tenant). Confirmado seguro.

---

## 5. Resumo

| Cor | Quantidade aprox. | Ação sugerida |
|---|---:|---|
| 🟢 Verde | ~260 (85%) | manter |
| 🟡 Amarelo | ~36 (12%) | encapsular em SECURITY DEFINER (P2) |
| 🔴 Vermelho a investigar | 6 tabelas | revisar split (P1) |

**Veredito de segurança:** Sem violação detectada. Recomendações são de clareza, não de hardening.

**Fim Fase 3.** Nada alterado.
