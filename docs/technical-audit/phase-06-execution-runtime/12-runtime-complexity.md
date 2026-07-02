# 12 — Runtime Complexity

Métricas por fluxo (camadas / chamadas / decisões / escritas / leituras / validações). Contagens observadas a partir do código.

| Fluxo | Camadas | Chamadas | Decisões | Escritas | Leituras | Validações |
|---|---|---|---|---|---|---|
| F1 Criar Atendimento | 8 | ~10 | 5 | 2-4 (atend + exames + audit + billing) | 3-6 (catálogo, preço, paciente, convênio) | 6 (zod, edge, RPC, RLS, trigger RBAC, FK) |
| F2 Registrar Pagamento | 7 | ~7 | 3 | 2 (pagamento + audit) | 2 (saldo, atend) | 5 |
| F3 Digitar/Liberar Resultado | 9 | ~14 | 6 | 2-3 (exame + audit + entrega) | 5+ (parâmetros, VR, régua, catálogo, histórico) | 7 |
| F4 Coleta | 6 | ~6 | 2 | 2 (amostra + movimentação + audit) | 2 | 4 |
| F5 Integração apoio | 10 | ~15 | 8 (circuit, retry, DLQ) | 4+ (jobs, requests, responses, results, health, circuit) | 5+ | 6 |
| F6 Migração runtime | 12+ | 24 edges | 10 | 100+ (dados inteiros) | idem | dupla (smoke test) |
| F7 Login | 5 | ~5 | 2 | 0 | 2 (profiles, user_roles) | 3 |
| F8 Inscrição pública | 4 | ~4 | 2 (rate limit, unique) | 1 | 1 | 3 |
| F9 Chat IA | 6 | ~5 | 3 (skill router) | 1 (ai_audit) | variável | 2 |
| F10 Impressão em lote | 4 | N atendimentos | 1 | 0 | N*muitas | 1 |

## Observações
- Fluxo mais denso: **Migração** (12+ camadas, 24 edges).
- Fluxo mais crítico: **Resultado** (auditoria dupla, VR dinâmicos, histórico, laudo).
- Fluxo mais simples: **Impressão em lote** (paralelismo puro).
