# Investigação — Distribuição dos Valores de Referência

**Data:** 2026-06-25
**Modo:** Somente leitura (nenhuma alteração feita).

---

## ETAPA 1 — Contagem real

| Métrica | Valor |
|---|---|
| Registros em `valores_referencia` | **165** |

---

## ETAPA 2 — Exames distintos

| Exames distintos com VR | 1 |
|---|---|

| Exame | Qtd. VR |
|---|---:|
| HEMOGRAMA COMPLETO | 165 |

Apenas **1 exame** concentra **100%** dos valores de referência.

---

## ETAPA 3 — Parâmetros

| Métrica | Valor |
|---|---:|
| Total de parâmetros cadastrados (`exame_parametros`) | 239 |
| Parâmetros com pelo menos 1 VR | 20 |
| Parâmetros SEM VR | 219 |
| Exames distintos com parâmetros cadastrados | 73 |
| Exames distintos com VR | 1 |

### Parâmetros COM VR (todos do HEMOGRAMA COMPLETO)

| Parâmetro | Qtd. VR |
|---|---:|
| Hemácias | 11 |
| RDW | 10 |
| Monócitos | 10 |
| Hematócrito | 10 |
| V.C.M | 10 |
| Bastonetes | 10 |
| C.H.C.M | 10 |
| Linfócitos | 10 |
| H.C.M | 10 |
| Eosinófilos | 10 |
| Hemoglobina | 10 |
| Plaquetas | 10 |
| Segmentados | 10 |
| VPM | 10 |
| Leucócitos | 10 |
| Basófilos | 10 |
| Prómielócitos | 1 |
| Metamielócitos | 1 |
| Linf. Reativos | 1 |
| Mielócitos | 1 |

**Total: 20 parâmetros** (16 com 10 faixas etárias/sexo + 1 com 11 + 4 com 1).

### Parâmetros SEM VR
**219 parâmetros** (em 72 exames distintos) não possuem nenhuma faixa de referência cadastrada.

---

## ETAPA 4 — Detecção de anomalias

| Verificação | Resultado |
|---|---|
| Exame com quantidade anormal de VR | ✓ HEMOGRAMA COMPLETO (165) — único caso, normal pelo nº de parâmetros × faixas |
| Exame repetido (mesmo nome) | ✗ Não |
| Diferenças de caixa (maiúscula/minúscula) em `exame_nome` | ✗ Não (apenas 1 valor distinto) |
| Espaços extras / acentuação divergente | ✗ Não detectado |
| Duplicidade textual | ✗ Não |

Distribuição consistente: 16 parâmetros têm exatamente 10 faixas, 1 tem 11 (Hemácias), e 4 parâmetros de série branca imatura têm 1 faixa cada.

---

## ETAPA 5 — Integridade

| Verificação | Resultado |
|---|---|
| Todo VR aponta para exame existente (`exame_id` FK) | ✓ Sim — M1 backfill foi 165/165 |
| Todo VR aponta para parâmetro existente (`parametro_id` FK) | ✓ Sim |
| VR órfão | ✗ Não |
| Exame sem parâmetro | Existem (não bloqueante) |
| Parâmetro sem exame | ✗ Não (FK garante) |

---

## ETAPA 6 — Validação da auditoria

**Afirmação:** "165 valores de referência pertencem a apenas 1 exame."

**Classificação:** ✅ **CORRETA**

- `COUNT(*) = 165` ✓
- `COUNT(DISTINCT exame_id) = 1` ✓
- `COUNT(DISTINCT exame_nome) = 1` ✓ (HEMOGRAMA COMPLETO)

Não há erro de auditoria. A informação da Fase 1 está confirmada.

---

## ETAPA 7 — Impacto

**A conclusão da Fase 1 muda? NÃO.**

A auditoria estava correta. Todas as recomendações da Fase 2 permanecem válidas:

- Subutilização real de `valores_referencia` (1/73 exames = 1,4% de cobertura).
- 219 parâmetros (91,6%) sem VR cadastrada — gap massivo de conteúdo clínico.
- Decisões arquiteturais (FKs, idade em dias, réguas etárias, UI matrix unificada) seguem aplicáveis.

Nenhuma recomendação precisa ser revisada.

---

## Entregáveis (resumo)

| Pergunta | Resposta |
|---|---|
| Quantos VR existem? | **165** |
| Quantos exames possuem VR? | **1** (HEMOGRAMA COMPLETO) |
| Quantos parâmetros possuem VR? | **20** de 239 |
| Exame com mais VR | HEMOGRAMA COMPLETO (165) |
| Dado inconsistente? | Não |
| Auditoria estava correta? | Sim |
| Origem da divergência | Não houve divergência |
| Decisão arquitetural a revisar? | Nenhuma |
