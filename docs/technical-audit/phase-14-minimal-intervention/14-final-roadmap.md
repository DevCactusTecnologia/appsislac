# 14 — Final Roadmap

Três fases independentes. Cada uma pode entrar em produção isoladamente.

## FASE 1 — Segurança & Conformidade (bloqueia produção)
Objetivo: fechar riscos ALTOS/CRÍTICOS de segurança e LGPD.

| ID | Intervenção |
|---|---|
| I05 | Fechar enumeração signup |
| I02 | Remover policy anon + buckets privados |
| I01 | MFA super_admin + cookie httpOnly |
| I03 | Edge upload-guard |
| I04 | Rate-limit persistido + rotação service-role |
| I06 | Portal LGPD + anonimização cron |

Entregável independente. Não depende de FASE 2/3.

## FASE 2 — Operação & Resiliência (bloqueia produção)
Objetivo: fechar F-DR-01 CRÍTICO e destravar observabilidade.

| ID | Intervenção |
|---|---|
| I10 | Provisionar staging |
| I09 | Sentry frontend + edges |
| I07 | Backup Storage + restore drill + down-migration template |
| I08 | Runbooks (incident, DR, dependencies) |

Entregável independente.

## FASE 3 — Performance & Manutenção (pós go-live)
Objetivo: sustentabilidade.

| ID | Intervenção |
|---|---|
| I11 | Keyset + partição + virtualização |
| I13 | Remover landing duplicada |
| I12 | Testes de contrato + smoke + splits cirúrgicos |

Entregável independente.
