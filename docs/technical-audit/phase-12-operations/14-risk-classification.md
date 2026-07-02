# 14 — Risk Classification

## CRÍTICO
- RST01 — Sem procedimento de restore end-to-end
- DR01 — Sem plano de Disaster Recovery formal
- OBS02 — Sem alertas ativos em produção
- RUN01 — Sem runbook de incidentes
- RUN03 — Sem runbook de restore
- DEP01 — SPOF Lovable Cloud sem failover

## ALTO
- ENV01 — Sem staging
- ENV03 — Dev/Prod compartilham backend
- DEP01(deploy) — Sem gate de aprovação
- DEP03(deploy) — Sem down-migrations
- BAK01 — Storage sem backup
- BAK02 — Sem rotina agendada
- BAK04 — Sem teste de integridade
- RST02 — Sem RPO/RTO
- RST03 — Sem teste periódico de restore
- DR02 — SPOF sem failover
- DR03 — Sem contingência integrações
- OBS01 — Sem APM/tracing
- OBS03 — Sem SLO
- SEC02 — Sem segregação secrets por ambiente
- CFG02 — Sem config por ambiente
- CI01 — Sem E2E no CI
- CI02 — Sem SAST/dep scanning
- MIG01 — Sem down-migrations
- MIG03 — Cobertura testes SQL mínima
- DEP(int)03 — Sem fallback PIX/WhatsApp
- DEP(int)04 — Storage sem backup próprio

## MÉDIO
- ENV02 — Sem canary
- DEP02(deploy) — Sem versionamento semântico
- BAK03 — Sem cofre externo secrets
- OBS04 — Sem dashboards
- SEC01 — Sem rotação automática service-role
- SEC03 — Sem alerta uso service-role
- CFG01 — Sem feature flags globais
- CI03 — Sem pipeline deploy versionado
- MIG02 — Sem linter migrations no CI
- DEP(int)02 — Sem multi-provider AI

## BAIXO
- (nenhum específico isolado)

## INFORMATIVO
- CFG03 — `vercel.json` não aplicável ao host atual

## INCONCLUSIVO
- BAK/evidência de execução de backup gerenciado
- DR — contingência PIX
- CFG — CSP real em runtime Cloud
