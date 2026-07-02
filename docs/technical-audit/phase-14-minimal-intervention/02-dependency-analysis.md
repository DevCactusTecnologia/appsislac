# 02 — Dependency Analysis

Grafo de dependências entre grupos (Phase 14/01).

```
G10 (staging) ──► G9 (obs)  ──► G7 (backup/restore drill)
                    │
                    └─► G8 (runbooks DR)

G1 (sessão/MFA) ──► G5 (auth hygiene)      [config Supabase Auth compartilhada]
G7 ──► G8                                    [restore alimenta runbook DR]
G6 ──► G7                                    [anonimização depende de backup íntegro]
```

## Efeitos de absorção

| Corrigir | Elimina automaticamente |
|---|---|
| G10 (staging) | Pré-requisito de qualquer drill em G7/G9; não elimina achado, mas destrava |
| G7 (restore documentado + testado) | F-DR-01, F-DR-02, F-MIG-01, parcialmente F-OPS-01 |
| G8 (runbooks) | F-OPS-01, F-DEP-01, F-DOC-01 |
| G1 (MFA obrigatório super_admin + cookie session) | F-SEC-01, F-SEC-02, F-SEC-10 |
| G6 (portal + job) | F-LGPD-01, F-LGPD-02 |

Nenhum grupo depende de reescrita arquitetural. Todos são aditivos.
