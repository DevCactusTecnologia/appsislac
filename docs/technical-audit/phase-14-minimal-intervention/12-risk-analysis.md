# 12 — Risk Analysis

| Risco | Ocorre? | Justificativa |
|---|---|---|
| Quebrar produção | NÃO | Mudanças aditivas; staging (I10) valida antes |
| Quebrar runtime | NÃO | Nenhuma alteração em `src/runtime/db.ts` ou fachada |
| Quebrar RLS | NÃO | I02 remove policy anon isolada; I04/I06 adicionam tabelas com padrão obrigatório de GRANT+RLS |
| Quebrar multi-tenant | NÃO | Nenhuma tabela perde `tenant_id`; portal LGPD escopa `auth.uid()` |
| Quebrar migração Shared→Dedicated | NÃO | Nenhum edge de migração é tocado; particionamento aplicado antes do flip preserva contrato |
| Quebrar impressão de laudo | NÃO | Layout impressão travado (memória `layout-impressao-travado`); I12 apenas split por seções sem tocar CSS |
| Quebrar Auth | Baixo | I01 usa APIs oficiais do SDK; I05 é config; validado em staging |

Mitigação transversal: **I10 (staging) precede toda intervenção com risco não-nulo.**
