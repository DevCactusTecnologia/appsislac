# 09 — Priority Matrix

Classificação de severidade por achado único. Sem repetições.

## CRÍTICO
| ID | Categoria |
|---|---|
| F-DR-01 | Restore não documentado / RPO/RTO ausentes |

## ALTO
| ID | Categoria |
|---|---|
| F-SEC-01 | JWT em localStorage |
| F-SEC-02 | MFA opcional |
| F-SEC-03 | Policy anon em documento_templates |
| F-SEC-06 | Sanitização SVG inconclusiva |
| F-LGPD-01 | Portal titular ausente |
| F-LGPD-02 | Anonimização automática ausente |
| F-OBS-01 | Sem APM/tracing/alertas |
| F-ENV-01 | Sem staging |
| F-DR-02 | Sem backup de Storage |
| F-MIG-01 | Sem down-migrations |
| F-OPS-01 | Sem runbooks |
| F-DEP-01 | Dependências sem fallback |
| F-QA-01 | Cobertura de testes baixa |
| F-CODE-01 | Arquivos >800 LOC |
| F-RT-01 | Runtime dedicated ocioso |
| F-PERF-02 | Sem particionamento tabelas hot |
| F-SCALE-01 | Escala >100 sem prova |

## MÉDIO
| ID |
|---|
| F-SEC-04, F-SEC-05, F-SEC-07, F-SEC-08, F-SEC-09, F-SEC-10, F-SEC-11, F-SEC-12, F-PERF-01, F-PERF-03, F-PERF-04, F-FE-01, F-FE-02, F-BE-01, F-INT-01, F-DOC-01 |

## BAIXO
| ID |
|---|
| F-SEC-13, F-SEC-14, F-SEC-15, F-CODE-02, F-FE-03 |

## INFORMATIVO
| ID |
|---|
| F-DATA-01, F-ARCH-01, F-SUP-01, F-CI-01, F-AUDIT-01 |

## Totais
| Severidade | Total |
|---|---:|
| CRÍTICO | 1 |
| ALTO | 17 |
| MÉDIO | 16 |
| BAIXO | 5 |
| INFORMATIVO | 5 |
| **Total** | **44** |
