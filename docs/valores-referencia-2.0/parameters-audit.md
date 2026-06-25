# Auditoria de Parâmetros — Valores de Referência 2.0

## Ciclo de vida de um parâmetro

1. **Nasce** em `ParametrosDialog.tsx` (aba "Parâmetros" do `DetalhesExameDialog`).
2. É salvo em `exame_parametros` (`addParametro` → store atualiza cache + notifica).
3. **Ligado ao exame** por `exame_id` (FK lógica; sem foreign key declarada — ver database-audit).
4. **Exibido** em:
   - `ResultadoDetalhe.tsx` → `LayoutScientificFormRenderer.tsx` para entrada de resultado.
   - `MatrizValoresReferencia.tsx` → coluna "Parâmetro" da matriz.
   - `FiltrosDialog.tsx` → lista plana.
5. **Usado na produção**:
   - `formula.ts` resolve `##CHAVE##` em fórmulas.
   - `criticoPipeline` lê `critico_min/max`.
   - `laudoResolver` substitui `##REF_x##`, `##FLAG_x##`, `##UNID_x##` no layout.

## Distribuição (prod)

| Tipo | Qtde | Observação |
|---|---|---|
| Texto | 88 | Texto livre. |
| Número | 84 | Usa `casas_decimais`, `qtd_digitos`. |
| Select | 39 | Usa `opcoes_select`. |
| Formula | 25 | Usa `formula` (coluna nova). |
| Tempo | 3 | Usa `formato_exibicao`. |

## Campos potencialmente sem consumidor

| Campo | Consumido em código? | Notas |
|---|---|---|
| `qtd_caracteres` | **Não** encontrado em uso ativo nas telas de resultado. | Provável legado. |
| `chave_apoio` | Apenas em mapeamento de provedores de apoio (`integration_provider_exam_params`). | Usado, mas baixo. |
| `exibir_anterior` | Não localizado. | Legado. |
| `exibir_mapa` | Usado em `mapaTrabalhoStore`/templates. | OK. |
| `obrigatorio` | Não bloqueia salvar resultado. | UI-only legado. |
| `visivel` | Filtragem em alguns layouts. | OK. |
| `valor_referencia` (texto livre) | Concorrência com `valores_referencia.descricao`. | Legado. |

## Duplicação

- **`valor_referencia` (parâmetro)** × **`valores_referencia.descricao` (matriz)**: ambos podem aparecer no laudo. Política não documentada.
- Parâmetros com mesma `chave` em exames diferentes são permitidos (unicidade só por `exame_id`). `findExamesComChave` existe mas é informativo, não bloqueia.

## Parâmetros sem consumidor

Não há rotina automatizada que detecte parâmetros órfãos (parâmetro existente sem nenhum VR / sem layout). Recomenda-se script de diagnóstico — proposta para Fase 2.
