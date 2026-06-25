# Inventário — Valores de Referência 2.0 (Fase 1)

> Auditoria estática (sem alteração de código/banco). Data: 2026-06-25.

## 1. Tabelas envolvidas

| Tabela | Local | Linhas (prod) | Papel |
|---|---|---|---|
| `public.valores_referencia` | Supabase | **165** | SSOT dos VRs cadastrados por exame+parâmetro+sexo+faixa de idade. |
| `public.exame_parametros` | Supabase | **239** (73 exames) | Define os parâmetros de cada exame e guarda **fallback global** de crítico/pânico (`critico_min`, `critico_max`) e o texto livre `valor_referencia` (legado). |
| `public.exames_catalogo` | Supabase | 441 | Cabeçalho do exame; ligado a `exame_parametros.exame_id`. |
| `public.exame_layouts` | Supabase | — | Layouts impressos; consomem placeholders `##REF_x##`, `##UNID_x##`, `##FLAG_x##` resolvidos a partir dos VRs. |
| **Réguas etárias** (sem tabela) | `localStorage` — `src/data/reguasEtariasStore.ts` | — | Presets de faixas etárias para montar a matriz. **Client-only**, namespaced por tenant. **Não persistem no banco.** |

> Observação: não existe tabela `reguas_etarias` no banco — é estado local do navegador. Os 2 presets de sistema (`sys:pediatrica-sysmex`, `sys:adulto-unico`) ficam embutidos em código.

## 2. Quantos registros existem hoje

- 165 VRs no total — **todos com `valor_min`/`valor_max`/`descricao` preenchidos** (zero linhas vazias).
- VRs cobrem apenas **1 exame distinto** (`exame_nome` único) — indica que o módulo está **subutilizado**.
- 239 parâmetros distribuídos em 73 exames.
  - Tipos: Texto 88 · Número 84 · Select 39 · Formula 25 · Tempo 3.
- **0 linhas** com `critico_min`/`critico_max` em `valores_referencia` — o recurso de "crítico por faixa" (Fase 1 do roadmap anterior) **nunca foi adotado em produção**.

## 3. SSOT (Single Source of Truth)

| Conceito | SSOT |
|---|---|
| Catálogo de exames | `exames_catalogo` |
| Parâmetros de cada exame | `exame_parametros` |
| Faixas de referência (min/max + sexo + idade + texto livre + crítico por faixa) | `valores_referencia` |
| Crítico/pânico fallback (sem distinção de sexo/idade) | `exame_parametros.critico_min` / `critico_max` |
| Texto livre legado de referência | `exame_parametros.valor_referencia` (sobrevive como placeholder, **competindo** com `valores_referencia`) |
| Réguas etárias (apresentação da matriz) | `localStorage` por tenant |

## 4. Quem consome

- **Frontend**:
  - `src/data/valoresReferenciaStore.ts` — store global em memória, single source de leitura.
  - `src/data/exameParametrosStore.ts` — cache por `exame_id`.
  - `src/data/reguasEtariasStore.ts` — réguas locais.
  - `src/components/configuracoes/MatrizValoresReferencia.tsx` — UI matriz sexo × faixa.
  - `src/components/configuracoes/FiltrosDialog.tsx` / `FiltrosPorPerfil.tsx` — CRUD linha a linha.
  - `src/components/configuracoes/GerenciarReguasDialog.tsx` — CRUD das réguas.
  - `src/components/configuracoes/ParametrosDialog.tsx` — cadastro do parâmetro + crítico fallback.
  - `src/pages/ResultadoDetalhe.tsx` + `services/criticoPipeline.ts` + `domains/result/services/criticoChecker.ts` — usa VRs no preenchimento e cálculo de "crítico".
  - `src/pages/admin/AuditoriaVR.tsx` — diagnóstico interno (não exposto ao usuário final).
  - `src/lib/laudoLayout.ts`, `src/lib/laudoResolver.ts` — substitui `##REF_*##` no laudo.
- **Backend**: nenhuma RPC ou trigger toca `valores_referencia` ou `exame_parametros` — apenas RLS por tenant.

## 5. Conclusão da Fase 1 do Inventário

- **3 tabelas relevantes** + 1 store client-side.
- **SSOT clara em DB**, mas **co-existência funcional** entre `exame_parametros.valor_referencia` (texto livre) e `valores_referencia` (estruturado) cria ambiguidade.
- Réguas etárias deveriam estar em DB para multi-device/multi-usuário.
