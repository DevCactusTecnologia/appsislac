# 04 — Master Findings Matrix

Cada achado aparece uma única vez. Origem = fase(s) onde foi evidenciado.

| ID | Categoria | Descrição | Origem (Fase/Relatório) | Evidência | Severidade | Status |
|---|---|---|---|---|---|---|
| F-SEC-01 | Segurança | JWT/refresh em `localStorage` | 09 / 02, 13, 14 | 09/02-authentication.md | ALTO | CONFIRMADO |
| F-SEC-02 | Segurança | MFA opcional inclusive super_admin | 09 / 02, 07, 14 | 09/02, 09/07 | ALTO | CONFIRMADO |
| F-SEC-03 | Segurança | Policy `doc_templates_demo_anon_select` permite anon | 09 / 04, 14 | 09/04-rls-audit.md | ALTO | CONFIRMADO |
| F-SEC-04 | Segurança | Buckets `tenant-site/tenant-assets` públicos → enum path | 09 / 14 | 09/14 M01 | MÉDIO | CONFIRMADO |
| F-SEC-05 | Segurança | Rate-limit in-memory bypassável entre isolates | 09, 10 / 14 | 09/14 M03 | MÉDIO | CONFIRMADO |
| F-SEC-06 | Segurança | Sanitização SVG em uploads inconfirmada | 09 / 09, 14 | 09/09-upload | ALTO | INCONCLUSIVO |
| F-SEC-07 | Segurança | Sem rotação automática de service-role | 09, 12 / 14, 07 | 09/14 M04 | MÉDIO | CONFIRMADO |
| F-SEC-08 | Segurança | Antivírus/mime-sniff server-side ausente | 09 / 14 | 09/14 M02 | MÉDIO | CONFIRMADO |
| F-SEC-09 | Segurança | Retenção clínica (CFM 20a) sem enforcement técnico | 09 / 14 | 09/14 M05 | MÉDIO | CONFIRMADO |
| F-SEC-10 | Segurança | Impersonation sem step-up MFA | 09 / 14 | 09/14 M06 | MÉDIO | CONFIRMADO |
| F-SEC-11 | Segurança | Enumeração usuários no signup GoTrue | 09 / 14 | 09/14 M08 | MÉDIO | CONFIRMADO |
| F-SEC-12 | Segurança | Auth logs GoTrue não espelhados no app | 09 / 14 | 09/14 M07 | MÉDIO | CONFIRMADO |
| F-SEC-13 | Segurança | Logs sem hash-chain WORM | 09 / 14 | 09/14 B03 | BAIXO | CONFIRMADO |
| F-SEC-14 | Segurança | CORS `*` em edges autenticadas | 09 / 14 | 09/14 B02 | BAIXO | ACEITO |
| F-SEC-15 | Segurança | HSTS aplicacional não confirmado | 09 / 14 | 09/14 B01 | BAIXO | ACEITO |
| F-LGPD-01 | LGPD | Portal do titular ausente (Art. 18) | 09 / 11, 14 | 09/11-lgpd.md L01 | ALTO | CONFIRMADO |
| F-LGPD-02 | LGPD | Sem job de anonimização automatizada | 09 / 11, 14 | 09/11 L02 | ALTO | CONFIRMADO |
| F-PERF-01 | Performance | OFFSET pagination (`documento_templates`, `pacientes`) | 10 / 03 | 10/03-database-performance | MÉDIO | CONFIRMADO |
| F-PERF-02 | Performance | Sem particionamento em `audit_logs`, `whatsapp_outbox` | 10 / 11, 14 | 10/11-scalability | ALTO | CONFIRMADO |
| F-PERF-03 | Performance | 357k rollbacks desde boot (métrica ambiente) | 10 / 03 | 10/03 | MÉDIO | CONFIRMADO |
| F-PERF-04 | Performance | Ausência de virtualização em listas longas | 10 / 05 | 10/05-frontend-performance | MÉDIO | CONFIRMADO |
| F-OBS-01 | Observabilidade | Sem APM/tracing/alertas ativos | 07, 10, 12 / 10-obs, 06, 13 | 12/06, 10/10 | ALTO | CONFIRMADO |
| F-ENV-01 | Operação | Sem staging; dev==prod (Lovable Cloud) | 10, 12 / 01, 15 | 12/01-environments | ALTO | CONFIRMADO |
| F-DR-01 | Operação | Restore não documentado; sem RPO/RTO; sem teste | 10, 12 / 04, 05 | 12/04-restore | CRÍTICO | CONFIRMADO |
| F-DR-02 | Operação | Sem backup declarado de Storage | 12 / 03 | 12/03-backup | ALTO | CONFIRMADO |
| F-MIG-01 | Operação | Sem down-migrations; rollback schema manual | 10, 12 / 10 | 12/10-migrations-operations | ALTO | CONFIRMADO |
| F-OPS-01 | Operação | Sem runbooks de incidente/DR | 12 / 05, 11, 13 | 12/11-runbooks | ALTO | CONFIRMADO |
| F-DEP-01 | Operação | Dependências críticas (Cloud, AI, WA, PIX) sem fallback | 12 / 12 | 12/12-operational-dependencies | ALTO | CONFIRMADO |
| F-QA-01 | Código | Cobertura de testes baixa (11 specs / 469 arquivos) | 08, 10, 11 / 09, 11-15 | 11/09-testability | ALTO | CONFIRMADO |
| F-CODE-01 | Código | 25 arquivos >800 LOC em fluxos operacionais | 08, 11 / 02, 15 | 11/02-complexity | ALTO | CONFIRMADO |
| F-CODE-02 | Código | ~0.15 escapes de tipo/100 LOC | 11 / 10 | 11/10-technical-debt TD-05 | BAIXO | ACEITO |
| F-FE-01 | Frontend | Dualidade fetch (37 stores × 6 TanStack) | 08, 11 / 06, 10 | 08/06-state-management | MÉDIO | CONFIRMADO |
| F-FE-02 | Frontend | Ausência de framework de forms; validação inline | 08 / 07 | 08/07-forms | MÉDIO | CONFIRMADO |
| F-FE-03 | Frontend | Duas landings paralelas (Landing/LandingPageResponsive) | 08 / 03 | 08/03-pages | BAIXO | CONFIRMADO |
| F-BE-01 | Backend | 60/74 edges duplicam CORS/JWT (fora do `edgeBoot`) | 07, 11 / 11 | 07/11-standardization | MÉDIO | CONFIRMADO |
| F-RT-01 | Runtime | Runtime dedicated implementado, uso produtivo mínimo | 10, 11 / 08, 10 | 10/08-shared-dedicated-scale | ALTO | CONFIRMADO |
| F-DATA-01 | Dados | 116/119 tabelas tenant-aware (3 tabelas fora do padrão) | 05, 09 / 05 | 05/05-integrity-analysis | INFO | ACEITO |
| F-ARCH-01 | Arquitetura | Complexidade de execução moderada (multi-tenant/runtime híbrido) | 01, 06 / 08, 12 | 06/12-runtime-complexity | INFO | ACEITO |
| F-INT-01 | Integração | Circuit breaker/DLQ presentes; DLQ formal ausente para IA/PIX | 07, 10 / 05, 09 | 07/05-pipelines | MÉDIO | CONFIRMADO |
| F-SUP-01 | Governança | Super Admin plane isolado, revalidação server-side | 07, 09 / 08 | 07/08-server-security | INFO | ACEITO (força) |
| F-DOC-01 | Documentação | 247 .md; runbooks operacionais escassos | 11, 12 / 11 | 12/11-runbooks | MÉDIO | CONFIRMADO |
| F-CI-01 | CI/CD | CI bloqueante robusto; deploy delegado, sem canary formal | 11, 12 / 09 | 12/09-ci-cd | INFO | ACEITO (força) |
| F-AUDIT-01 | Auditoria | 7+ tabelas de auditoria + triggers em todas sensíveis | 03, 05, 09 | 09/12-auditability | INFO | ACEITO (força) |
| F-SCALE-01 | Escala | Suporte comprovado ~10–100 tenants; >100 exige tuning | 10 / 11 | 10/11-scalability | ALTO | CONFIRMADO |

**Total de achados únicos: 44** (após consolidação de duplicidades).
