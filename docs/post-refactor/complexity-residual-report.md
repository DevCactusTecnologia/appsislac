# FASE 6 — Complexidade Residual

## Hotspots (LOC)

| Arquivo | LOC | Classificação | Justificativa |
|---|---|---|---|
| `src/integrations/supabase/types.ts` | 6.953 | **Aceitável** | Auto-gerado. Não editar. |
| `src/pages/ResultadoDetalhe.tsx` | 2.627 | **Monitorar** | Orquestra render + assinatura + PDF + WhatsApp + portal. Layout congelado. |
| `src/pages/NovoAtendimento.tsx` | 2.570 | **Prioridade futura** | Wizard único + edição. Candidato a extrair sub-componentes (Exames, Pagamento, Recoleta). |
| `src/components/configuracoes/mapas/RichTextEditorPro.tsx` | 2.503 | **Aceitável** | Editor rico isolado; baixo blast radius. |
| `src/pages/Financeiro.tsx` | 2.413 | **Monitorar** | Já consome `useDicionario`; pode fatiar em abas. |
| `src/data/atendimentoStore.ts` | 1.504 | **Prioridade futura** | Store central; candidata a split por slice (criação, status, pagamentos). |
| `src/pages/superadmin/SuperAdminTenantDetalhe.tsx` | 1.160 | **Monitorar** | Painel administrativo amplo. |
| `src/pages/Index.tsx` | 1.154 | **Monitorar** | Lista de atendimentos com filtros + ações em massa. |
| `src/pages/Mapa.tsx` | 1.143 | **Monitorar** | Geração de mapas de trabalho. |
| `src/pages/RegistrarColeta.tsx` | 1.114 | **Monitorar** | Layout duplo (mem://features/operacional/coleta-layout). |
| `src/pages/AnalisarAmostra.tsx` | 987 | **Aceitável** | Abaixo de 1.000. |

## Outros indicadores

- `useState`/`useEffect` por arquivo não amostrados em detalhe nesta auditoria; recomendação: passar lint customizado em `NovoAtendimento.tsx` e `ResultadoDetalhe.tsx` para quantificar.
- Stores Zustand: ~30 (esperado para o domínio). Já houve consolidação de dicionários para `useDicionario`.

**Veredito:** Complexidade residual está concentrada em **3 páginas-monstro** (Resultado, NovoAtendimento, Financeiro) e em **1 store central** (atendimentoStore). Nenhuma é bloqueante; entram como roadmap de refactor incremental.
