# Auditoria — Layout Científico

## Fontes
- `public.exame_layouts` (73 linhas) — conteúdo HTML do laudo (CKEditor).
- `public.exame_parametros` (41 linhas) — campos do resultado.
- `public.valores_referencia` (164 linhas) — VR sexo/idade.
- `public.reguas_etarias` — réguas de faixas.

## Ownership oficial (já documentado no store)
O cabeçalho de `exameLayoutsStore.ts` declara:
> Esta store representa o MOTOR CIENTÍFICO/REGULATÓRIO do laudo:
> metodologia, unidade, VR, cálculos, interpretação, renderização clínica.

## Campos do `exames_catalogo` que pertencem ao Layout
| Campo no catálogo | Onde deveria estar |
|---|---|
| `metodologia` | `exame_layouts.config.metodologia` (snapshot por versão) |
| `unidade_padrao` | `exame_layouts.config.unidade` |
| `texto_interpretativo_padrao` | conteúdo HTML do layout |
| `exibir_metodologia_laudo` | `exame_layouts.config.show.metodologia` |
| `exibir_unidade_laudo` | `exame_layouts.config.show.unidade` |
| `exibir_material_laudo` | `exame_layouts.config.show.material` |
| `template_laudo_id` | redundante com `exame_layouts.id` padrão |
| `grupo_impressao` | `exame_layouts.config.grupo` |
| `ordem_impressao` | `exame_layouts.config.ordem` |

## Diagnóstico
- Existe **dualidade**: a UI atual de cadastro ainda expõe `metodologia` e
  `unidade_padrao` como defaults, mas o Layout Científico é a fonte de
  verdade RDC 786/2023.
- Risco: divergência entre o que está no catálogo e o que sai no laudo.
- Os campos `exibir_*_laudo` têm **0 leituras** no código → o snapshot do
  layout já decide o que mostrar.

## Recomendação
1. Mover esses 9 campos para `exame_layouts.config` (jsonb).
2. Manter no catálogo apenas `unidade_padrao` como referência para
   parâmetros sem layout (fallback).
3. Reforçar regra: mudou reagente/método → novo layout + novo snapshot.

## Acoplamento entre Layout e Parâmetros
- `exame_layouts.conteudo` referencia parâmetros via placeholders
  (`{{parametro.chave}}`, `##REF_X##`, `##UNID_X##`, `##FLAG_X##`).
- Resolução de referência é por par `(exame_nome, parametro_nome)` em
  `valores_referencia` → frágil (string-based). Ver `dead-code-report.md`.
