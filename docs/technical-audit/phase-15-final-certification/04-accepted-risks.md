# 04 — Accepted Risks Review

Fonte: Phase 14/08-accepted-risks-review.md.

| ID | Justificativa técnica | Risco residual | Continua aceitável? |
|---|---|---|---|
| F-SEC-14 | CORS `*` neutralizado por JWT obrigatório | Baixo | SIM |
| F-SEC-15 | HSTS delegado ao edge do Cloud | Baixo | SIM |
| F-CODE-02 | Débito localizado (`as any` 0.15/100LOC) | Baixo | SIM |
| F-DATA-01 | 3 tabelas globais justificadas | Baixo | SIM |
| F-ARCH-01 | Runtime híbrido já consolidado (surgery) | Baixo | SIM |
| F-SUP-01 | Super admin isolado (força arquitetural) | Nenhum | SIM |
| F-CI-01 | CI robusto; canary não requerido no atual porte | Baixo | SIM |
| F-AUDIT-01 | Auditoria por triggers (força) | Nenhum | SIM |

Nenhum item aceito precisa ser promovido.
