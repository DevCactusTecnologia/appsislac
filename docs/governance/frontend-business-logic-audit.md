# Frontend Business Logic — Audit

> Fase 3 — Mapeia lógica que poderia migrar para backend.
> Apenas auditoria. Sem alterações.

## Princípio

> Frontend exibe. Backend decide.

Exceção tolerada: cálculos triviais de exibição (formatação, máscaras,
ordenação local de listas já paginadas).

## Classificação

| Local | Tipo | Pode permanecer? | Razão |
|---|---|---|---|
| `atendimentoStore.totalPago/totalDevido` | Agregação financeira | ⚠️ Idealmente RPC | Já feito no DB, recomputado no store p/ optimistic |
| `Financeiro.tsx` — agregações de Entradas/Saídas | Dashboard financeiro | ❌ Migrar | KPIs cabem em RPC `kpis_financeiro(periodo)` |
| `Dashboard.tsx` — KPIs operacionais | Agregação multi-tabela | ❌ Migrar | Hoje via `useDashboardKpis` (parcial RPC); restante client |
| `pages/Resultados.tsx` — filtros/contagens | UI | ✅ Manter | Filtragem de lista carregada |
| `lib/criticoChecker.ts` | Regra clínica (limites) | ⚠️ Espelhar no DB | Já há `valores_referencia` no DB; checker repete lógica |
| `lib/laudoResolver.ts` | Resolução de template | ✅ Manter | Pura, sem regra de negócio |
| `lib/comprovantes.ts` (1121 linhas) | Geração de HTML/PDF | ✅ Manter | Apresentação |
| `pages/NovoAtendimento.tsx` — precificação dinâmica | Regra de negócio | ⚠️ Híbrido | Hoje só no client; ok enquanto não houver consumidor backend |
| `pages/AnalisarAmostra.tsx` — validação clínica | Regra clínica | ⚠️ Espelhar | Idem critico |
| Normalização CPF/telefone/datas | Utilitário | ✅ Manter | `src/lib/{cpf,masks,idade}.ts` |
| `lib/dossieRastreabilidade.ts` | Agregação multi-tabela | ❌ Migrar | RPC `dossie_atendimento(id)` |

## Hotspots a migrar (futuro, não agora)

1. **KPIs Financeiro/Dashboard** → RPC `kpis_*(tenant, periodo)`
2. **Dossiê de rastreabilidade** → RPC agregada
3. **Limites clínicos (criticidade)** → função SQL `is_critico(exame, valor, sexo, idade)`

## Hotspots a NÃO migrar

- Comprovantes/laudos/etiquetas (apresentação)
- Editor de mapas (TipTap — runtime client)
- Filtros e ordenação de listas paginadas
- Precificação dinâmica (sem consumidor backend hoje)

## Regra permanente

Antes de adicionar nova lógica no frontend, responder:

1. É **agregação** sobre múltiplas tabelas? → RPC.
2. É **regra clínica/financeira** que afeta dado persistido? → DB/RPC.
3. É **derivação de status** que o DB já calcula? → consumir, não recomputar.
4. É **apresentação** (HTML, formatação, filtro local)? → frontend ok.
