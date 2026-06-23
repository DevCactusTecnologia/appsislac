# Plataforma 2.0 — Fase 5: Tabelas Órfãs

Análise cruzada entre `src/` (stores, hooks, edge functions), views, triggers e RPCs.

## Classificação

| Status    | Critério |
|-----------|----------|
| Ativa     | Consumida por frontend ou edge function ou RPC pública |
| Legado    | Apenas escrita por trigger/auditoria, sem leitura ativa em UI |
| Órfã      | Zero consumidores em qualquer camada |

## Resultado

**Nenhuma tabela órfã encontrada.** As 116 tabelas têm pelo menos um consumidor.

### Tabelas Ativas (≈ 95)
Toda tabela referenciada por store/hook em `src/data/` ou por edge function em `supabase/functions/`. Exemplos: `atendimentos`, `pacientes`, `exames_catalogo`, `amostras`, `whatsapp_outbox`, `convenio_faturas`, `caixa_sessoes`.

### Tabelas Legado-ish / write-only (candidatas a revisão — NÃO remover)

| Tabela | Observação |
|--------|------------|
| `atendimento_audit` | Forward por `fwd_atendimento_audit_to_operational` → `operational_audit`. Possível duplicação de propósito com `operational_audit`. |
| `app_settings_audit` | Forwarder ativo (`fwd_app_settings_audit_to_platform`) duplica para `platform_audit`. |
| `protocolo_auditoria` | Forwarder ativo → `operational_audit`. Mantida por compatibilidade. |
| `pdf_override_audit` | Forwarder → `operational_audit`. |
| `storage_audit` | Forwarder → `operational_audit`. |
| `financeiro_audit` | Auditoria específica; coexiste com `operational_audit` (split intencional documentado). |
| `tenant_rate_limit` / `public_rate_limits` | Duas tabelas para rate limit (uma por tenant, outra para endpoints públicos). Não órfãs, mas merecem doc. |
| `guia_sequence` / `protocolo_sequence` / `amostra_sequence` | Counters de sequência — uso apenas via RPCs internas. Ativas. |
| `exames_publicos` (tabela) vs `exames_publicos_view` | Tabela materializada + view sobre catálogo. Manter; ver duplication-audit. |

> Conclusão: **0 tabelas órfãs**. Existem ~6 tabelas de auditoria com **possível redundância**, documentadas em `duplication-audit.md`.
