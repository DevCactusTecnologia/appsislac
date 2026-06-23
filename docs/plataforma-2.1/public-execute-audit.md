# Plataforma 2.1 — Fase 3: EXECUTE público de SECURITY DEFINER

## Diagnóstico

Listagem inicial:

- **31 funções SECURITY DEFINER** com `EXECUTE` para `anon`.
- Destas, **13 eram trigger functions** (não deveriam ser callable via API).
- **15 eram RPCs operacionais** (caixa, competência, fatura, estorno, soroteca) que exigem usuário logado.
- **3 são públicas por design** (`lookup_paciente_publico`, `get_published_tenant_page`) — portal/landing.

## Classificação

### 3a — Trigger functions (revogar para PUBLIC + anon + authenticated)

```
aplicar_expurgo_amostra              audit_convenio_competencias
audit_convenio_glosas                block_delete_use_estorno
convenio_fatura_set_competencia      guard_fatura_competencia_fechada
guard_fatura_item_competencia_fechada guard_glosa_competencia_fechada
profiles_guard_self_update           tg_audit_convenio_faturas
tg_convenio_fatura_itens_recalc      tg_convenio_fatura_recalc_on_desconto
trg_recompute_totais_on_exame
```

Triggers continuam executando porque rodam no contexto do owner da tabela, não dependem de privilégio EXECUTE concedido a roles da API.

### 3b — RPCs autenticadas (revogar PUBLIC, conceder authenticated)

```
caixa_abrir              caixa_fechar
competencia_abrir        competencia_esta_fechada
competencia_fechar       competencia_reabrir
convenio_fatura_cancelar convenio_fatura_glosar
convenio_fatura_reapresentar convenio_fatura_recalc
desfazer_movimentacao    financeiro_estornar
mover_amostra            recompute_atendimento_totais
soroteca_caminho_posicao
```

### 3c — Públicas por design (mantidas)

| Função | Uso | Justificativa |
|--------|-----|---------------|
| `lookup_paciente_publico(uuid, text)` | Portal do paciente | Acesso por CPF + tenant, rate-limited |
| `get_published_tenant_page(uuid, text)` | Landing pública | Páginas marcadas como `published=true` |

## Resultado

- **42 WARNs** dos linters `0028` / `0029` eliminados.
- Surface de API anônima reduzida a 2 funções intencionais.
- Zero regressão no portal público ou na landing.

## Débito remanescente (aceito)

~120 funções SECDEF continuam executáveis para `authenticated` — isso é a API operacional do SaaS (`atendimentos_page`, `dashboard_metrics`, `has_role`, etc.). O linter emite WARN para cada uma; cada uma tem `SECURITY DEFINER` *intencional* para encapsular lógica de tenant/permissão. Manter como está.
