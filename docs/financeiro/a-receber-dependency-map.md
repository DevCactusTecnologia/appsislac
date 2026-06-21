# A Receber — Mapa de Dependências (Fase 7)

## Quem consome `financeiro_a_receber_v2` / `financeiro_a_receber_totais`

```
financeiro_a_receber_v2 (linhas detalhadas)
├── useAReceberPacientes  ──► Financeiro » aba "A Receber" » sub-aba Pacientes
└── useAReceberConvenios  ──► Financeiro » aba "A Receber" » sub-aba Convênios
                          ──► Financeiro » aba "Convênios"
                          ──► ConveniosTab (listagem)

financeiro_a_receber_totais (totalizador único)
├── useAReceberTotais      ──► Dashboard (HeroKpi "A receber")
                           ──► RecepcionistaDashboard (Kpi "Receita do dia → A receber")
                           ──► Financeiro » Painel (card "A Receber Total")
└── dashboard_kpis (server)──► campo financeiro.aReceber do JSON
                                (consumido por useDashboardKpis no caminho RPC)
```

## Classificação final

| Item | Status |
|------|--------|
| `financeiro_a_receber_v2` | **SSOT — linhas** |
| `financeiro_a_receber_totais` | **SSOT — totais** (Fase 7) |
| `dashboard_kpis` | **DERIVADO** — agora delega A Receber para `financeiro_a_receber_totais` |
| `a_receber_pacientes_page` | **REMOVIDA** (drop) |
| `financeiro_resumo` | **MANTIDA** — semântica de período (não é "A Receber atual") |
| `Dashboard.financeiroLegacy.aReceber` | **DESATIVADA** — sobreposto pelo SSOT |
| `RecepcionistaDashboard.kpis.aReceber` (cálculo local) | **REMOVIDO** — substituído pelo SSOT |
| `computePainelKpis(... aReceberPacientes, aReceberConvenios)` | **REASSINADO** — recebe `AReceberTotaisInput` do SSOT |

## Regra a partir da Fase 7

> Toda tela que mostra **um número total** de "A Receber" deve consumir
> `useAReceberTotais()`. Toda tela que mostra **lista detalhada** deve
> consumir `useAReceberPacientes` / `useAReceberConvenios`. Nenhum
> componente pode somar saldos client-side.
