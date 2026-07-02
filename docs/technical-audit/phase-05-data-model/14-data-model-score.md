# 14 — Data Model Score

Avaliação factual por dimensão. Nota: 0 (péssimo) → 10 (excelente).

| Dimensão | Nota | Evidência |
|---|:---:|---|
| Cobertura do domínio | 9,5 | 100% dos macroprocessos representados; 20 domínios, 55+ tabelas clínicas |
| Normalização (3FN) | 8,5 | Núcleo em 3FN; denormalizações intencionais para histórico/auditoria |
| Integridade (PK/FK/UNIQUE) | 8,0 | 119 PKs, 147 FKs, 39 UNIQUEs; ausências deliberadas (tenant_id sem FK, VR textual) |
| Integridade (CHECK) | 7,5 | 1.240 CHECKs cobrindo status/transições; gaps em `valores_referencia` |
| RLS / segurança | 9,5 | 373 policies, padrão canônico de 4 verbs, sem `USING(true)` no domínio |
| Regras no banco (RPC/trigger) | 9,0 | RPCs `*_tx` como ponto único de mutação; auditoria via trigger |
| Auditoria / rastreabilidade | 9,5 | Cobertura quase total (LGPD/RDC 302); tabelas `*_audit` imutáveis |
| Multi-tenant (isolamento) | 9,5 | 116/119 tabelas com `tenant_id NOT NULL`; RLS + `current_tenant_id()` |
| Coerência de migrations | 8,0 | 355 migrations lineares; sem squash mas com história rastreável |
| Alinhamento com camadas | 9,0 | Frontend/store/edge/RPC bem separados; validado por guardrails |
| Configurabilidade | 8,5 | ~30 tabelas de configuração vs. ~40 operacionais — balanço saudável |
| Runtime Shared/Dedicated | 8,0 | Modelo idêntico dos dois lados; control-plane isolado no Shared |
| Padronização de nomes | 8,5 | Snake_case consistente, prefixos por domínio (`atendimento_*`, `amostra_*`, `financeiro_*`, `integration_*`) |
| Documentação interna | 9,0 | 43+ docs em `docs/database-runtime/`, `docs/valores-referencia-2.0/`, `docs/plataforma-*` |
| Áreas de dívida detectadas | 7,0 | VR textual, dicionários redundantes, colunas de UI legadas em `exame_parametros` |

**Score global: 8,6 / 10**

## Distribuição
- **Excelente (≥9,0)**: cobertura, RLS, auditoria, multi-tenant, RPCs, alinhamento, docs.
- **Bom (8,0–8,9)**: normalização, integridade FK, migrations, runtime, nomenclatura, configurabilidade.
- **Adequado (7,0–7,9)**: CHECKs (gap em VR), áreas de dívida conhecida.
- **Regular ou pior**: nenhuma dimensão.

## Pontos fortes concretos
1. Ponto único de mutação para operações críticas (RPCs `*_tx`).
2. Trilha de auditoria universal (tabelas `*_audit` imutáveis).
3. RLS uniforme e denso (média 3+ policies/tabela).
4. Cobertura completa dos macroprocessos do laboratório.
5. Modelo idêntico entre Shared e Dedicated — reduz risco na migração.

## Pontos fracos concretos
1. `valores_referencia` com tipagem fraca (texto onde caberia enum/numeric + CHECK).
2. Dicionários redundantes entre `select_options` e listas `financeiro_*`.
3. Colunas de UI em `exame_parametros` sem uso consistente.
4. 355 migrations sem squash — dificulta bootstrap rápido de novos ambientes.
5. `tenant_id` sem FK: decisão consciente, mas depende integralmente de RLS + `NOT NULL` para consistência.
