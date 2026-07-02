# 05 — Rejected Interventions

Sugestões plausíveis mas rejeitadas por violarem os princípios (simples/enxuto/menor impacto).

| Sugestão rejeitada | Motivo |
|---|---|
| Criar `SessionProvider` custom com refresh rotativo | SDK Supabase já faz. Duplicaria lógica. (viola #7, #8) |
| Migrar 37 stores para TanStack Query | Reescrita massiva; F-FE-01 é MONITORAR, não CORRIGIR. (viola #7, #10) |
| Introduzir Redis para rate-limit | Nova dependência de infra. Tabela SQL resolve. (viola #9) |
| Criar camada `StorageProvider` para trocar buckets | Sem 2º provider real. YAGNI. (viola #8) |
| Ativar runtime dedicated em todos os tenants (F-RT-01) | MONITORAR; não reduz risco de produção. (viola #4) |
| Reescrever `ResultadoDetalhe.tsx` do zero | Alto risco de regressão clínica. Split cirúrgico basta. (viola #7) |
| Adotar Clean Architecture / DDD tático | Sem problema de domínio comprovado; arquitetura consolidada. (viola #6, #10) |
| Framework interno de forms (F-FE-02) | MONITORAR; validação inline funciona. (viola #10) |
| Introduzir GitHub Actions de deploy próprio | Deploy delegado ao Cloud é força (F-CI-01). (viola #6) |
| Multi-provider AI/PIX/WhatsApp | Escopo enorme; DEP-01 mitigável por runbook de contingência. (viola #4) |
| Reorganizar pastas `src/` | Zero redução de risco. (viola #4, #6) |
