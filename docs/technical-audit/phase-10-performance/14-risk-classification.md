# 14 — Risk Classification

## Consolidado (Fase 10)

### CRÍTICO
_Nenhum._

### ALTO
| ID | Item |
|---|---|
| E02 | Rate-limit in-memory bypassável por concorrência de isolates |
| RT03 | Realtime broadcast/presence sem enforcement por tenant |
| SC02 | 100 tenants requer tuning de pool + paginação `documento_templates` |
| SC04 | Sem particionamento em `audit_logs`, `operational_audit`, `whatsapp_outbox` |
| P01 | Sem DLQ formal em nenhum pipeline |
| O01 | Sem APM / tracing distribuído |
| O02 | Sem alerta ativo configurado |
| D01 | SPOF único de plataforma (Lovable Cloud) |
| PR01 | Sem down-migrations |
| PR03 | RPO/RTO não documentados |
| PR04 | Cobertura de testes baixa |
| PR05 | Restore procedure não documentado |

### MÉDIO
| ID | Item |
|---|---|
| DB01 | `documento_templates` sem cursor pagination |
| F01 | Sem virtualização em listas |
| F02 | Dualidade Query Cache vs Store in-memory |
| F03 | Arquivos > 100KB em rotas críticas |
| ST01 | Sem antivírus/MIME sniffing |
| ST02 | Buckets públicos com enumeração |
| P03 | PDF em lote depende do browser |
| O03 | Sem SLO documentado |
| O04 | Observabilidade operacional fraca |
| SCA01 | Memória DB 67% |
| SCA02 | `documento_templates` OFFSET |
| D02 | Sem fallback multi-provider IA |
| D04 | Quota WhatsApp não monitorada |
| PR02 | Sem canary/blue-green |

### BAIXO
| ID | Item |
|---|---|
| DB02 | `pacientes` OFFSET legada coexiste |
| E01 | Sem singleton de client por isolate |
| RT02 | Sem debounce de eventos realtime |

### INFORMATIVO
| ID | Item |
|---|---|
| SC01 | 10 tenants suportado (evidência) |

### INCONCLUSIVO
| ID | Item |
|---|---|
| DB03 | Taxa de rollback desconhecida |
| DB04 | Cobertura de índices por policy não validada |
| E03 | Métricas de cold start não expostas |
| E04 | Max concurrent invocations não confirmado |
| F04 | Sem métrica LCP/INP |
| ST03 | TTL de signed URL não parametrizado |
| ST04 | Sem métricas de storage por tenant |
| RT01 | Publication `supabase_realtime` não enumerada |
| SC03 | 500/1000 tenants sem load test |
| P02 | Cron scheduling não documentado |
| P04 | Retry policy IA/WhatsApp não confirmadas |
| SCA03 | Rollbacks acumulados — taxa desconhecida |
| SCA04 | Sem métrica de throughput real |
| D03 | Sem contingência PIX |
