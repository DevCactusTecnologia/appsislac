# 08 — Open Questions / Lacunas

## Assuntos sem evidência suficiente
Herdados dos "INCONCLUSIVOS" originais das fases 09 e 10:

| # | Pergunta aberta | Fase de origem |
|---|---|---|
| Q01 | Assinatura de `whatsapp-webhook` é validada? | 09 X01 |
| Q02 | Policies do bucket `assinaturas` são restritas? | 09 X02 |
| Q03 | Realtime broadcast/presence aplica RLS efetivo? | 09 X03 |
| Q04 | Existem CVEs abertas via `npm audit`? | 09 X04 |
| Q05 | Edges com `fetch` externo estão livres de SSRF? | 09 X05 |
| Q06 | Todas as 200 RPCs revogam `EXECUTE` de `anon`? | 09 X06 |
| Q07 | Allowlist de extensão em buckets públicos? | 09 X07 |
| Q08 | Limite de tamanho por endpoint de upload? | 09 X08 |
| Q09 | `super_admin_impersonation_log` é completo? | 09 X09 |
| Q10 | Sanitização de SVG em uploads (F-SEC-06) | 09 |
| Q11 | Comportamento sob carga com 100+ tenants concorrentes | 10 |
| Q12 | Métrica real de complexidade ciclomática por função | 11 |
| Q13 | RTO/RPO efetivos do Lovable Cloud (não declarados) | 12 |
| Q14 | Tempo real de restore fim-a-fim | 12 |

## Dependências de testes futuros
- Load test multi-tenant (100+, 1000+).
- Drill de restore com cronometragem.
- Pen-test caixa-preta em edges públicas.
- Scanner de dependências (SCA).
