# FASE 4 — Hotspots Report

| Módulo | Ainda hotspot? | Motivo | Complexidade atual | Próxima ação |
|---|---|---|---|---|
| **ResultadoDetalhe** | ⚠️ SIM (parcial) | 2241 linhas, mas layout de impressão **congelado por constraint** (`mem://constraints/layout-impressao-travado`). Lógica não-impressão já foi para `domains/result/services/`. | **Média** | **Monitorar** — não refatorar enquanto constraint vigente |
| **NovoAtendimento** | ⚠️ SIM (parcial) | 2527 linhas no wizard; helpers puros já extraídos (pricing/buildExamesCobranca/contarEtiquetas/resyncCobrancaConvenios). Resto é UI de wizard multi-step. | **Média** | **Refatoração futura** — split por step do wizard (Paciente / Exames / Pagamento / Confirmação) |
| **Financeiro** | ❌ NÃO | Reduzido de 1541 → 924 linhas. Orchestrator puro consumindo `FinanceiroContext` + 4 tabs componentizadas. | **Baixa** | **Nenhuma** (manter; R-01 e R-05 são tickets pontuais, não estruturais) |
| **atendimentoStore** | ❌ NÃO | Já modularizado em 8 arquivos coesos (`queries`, `mutations`, `realtime`, `exames`, `terceirizados`, `types`, `_internal`, `index`). | **Baixa** | **Monitorar** crescimento de `mutations.ts` |

## Hotspots secundários observados

| Arquivo | Linhas | Avaliação |
|---|---|---|
| `RichTextEditorPro.tsx` | 2503 | Editor vendor-like, estável → **nenhuma ação** |
| `SuperAdminTenantDetalhe.tsx` | 1160 | Telão administrativo; baixa rotatividade → **monitorar** |
| `Index.tsx` | 1154 | Landing administrativa → **monitorar** |
| `Mapa.tsx` | 1143 | Operacional, alta densidade visual → **refatoração futura** (split por seção) |
| `RegistrarColeta.tsx` | 1114 | Wizard de coleta → **refatoração futura** (similar a NovoAtendimento) |

## Veredito Fase 4

- **Hotspots críticos eliminados:** `Financeiro` e `atendimentoStore`.
- **Hotspots parciais remanescentes:** `NovoAtendimento` e `ResultadoDetalhe` — porém com a lógica de negócio já isolada em serviços puros. O resto é UI grande, não complexidade essencial.
- **Próximos candidatos naturais:** `RegistrarColeta` e `Mapa`, que ainda não passaram pelo programa.
