# Mapa de Domínio — Valores de Referência 2.0

## 1. Ciclo de vida

```
exames_catalogo (1) ──< exame_parametros (N) ──< [valores_referencia] (N)
        │                       │                            │
        │                       └─ critico_min/max fallback  │
        │                       └─ valor_referencia (texto)  │ (legado)
        │                                                    │
        └── exame_layouts (placeholders ##REF_x##) ──────────┘
                                │
                                ▼
                      ResultadoDetalhe.tsx
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 entrada de valor       avaliarCritico()        substituição no laudo
 (ParamTypedInput)      (criticoPipeline)       (laudoResolver/laudoLayout)
```

## 2. Fontes de verdade por aspecto

| Aspecto | Fonte | Risco |
|---|---|---|
| Faixa normal (min–max) por sexo/idade | `valores_referencia` | OK |
| Texto livre da referência no laudo | `valores_referencia.descricao` **OU** `exame_parametros.valor_referencia` | **Duplicação real**. Hoje, `descricao` é preferido pelo `MatrizValoresReferencia`; `valor_referencia` é mantido como texto legado por parâmetro. Possível conflito se ambos preenchidos. |
| Crítico/pânico (sem sexo/idade) | `exame_parametros.critico_min/max` | OK como fallback global. |
| Crítico/pânico (por sexo/idade) | `valores_referencia.critico_min/max` | **Implementado mas não usado** (0 linhas). |
| Réguas etárias | `localStorage` por tenant | **Inconsistência multi-device**: cada navegador tem suas próprias réguas customizadas. |

## 3. Cache & sincronização

- `valoresReferenciaStore` carrega **toda** a tabela uma única vez no boot (`_initValoresReferenciaStore`) e mantém em array de módulo. Sem invalidação reativa por realtime.
- `exameParametrosStore` carrega **sob demanda** por `exame_id` e cacheia em `Map`. Realtime não escuta a tabela.
- `reguasEtariasStore` cacheia em `Map` por tenant + `localStorage`.
- Não há `react-query` cobrindo essas leituras → bypassa a política de `queryKey ["tenant", ...]` documentada em `mem://architecture/cache-governance`.

## 4. Pontos de duplicação confirmados

1. **`valor_referencia` (texto livre por parâmetro)** ↔ **`valores_referencia.descricao` (texto por célula)** — ambos chegam ao laudo, sem ordem definida.
2. **`exame_parametros.critico_min/max`** ↔ **`valores_referencia.critico_min/max`** — pipeline de críticos faz override quando o segundo está preenchido (hoje, sempre vazio).
3. **Réguas etárias presets vs. customizadas** — não há merge no banco.

## 5. Resumo

- Existe **mais de uma fonte de verdade** para "texto que aparece no laudo".
- Existe **duplicação intencional mas não documentada** entre crítico global × por faixa.
- Cache totalmente em memória sem invalidação cruzada.
