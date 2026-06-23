# Exames 2.1 — Sub-fase A + B

**Limpeza Segura + Interface Engine Readiness**

> Status: ✅ Concluído. Aguardando aprovação para próximas fases.

---

## 1. Resumo executivo

| Métrica | Antes | Depois | Δ |
|---|---:|---:|---:|
| Colunas em `exames_catalogo` | 69 | **51** | −18 |
| Colunas operacionais úteis | 41 | 48 (+3 interface readiness) | +7 |
| Colunas mortas (0 consumidores) | 21 | **0** | −21 |
| Campos no `ExameCatalogo` (TS) | 70 | 52 | −18 |
| Defaults inicializados em `NovoExameDialog` | 52 | 34 | −18 |

> 21 colunas removidas, 3 adicionadas. Saldo líquido: −18 colunas.

---

## 2. Sub-fase A — Limpeza Segura

### Colunas removidas (21)

Todas com **0 consumidores reais** confirmado por triple-grep (`src/`,
`supabase/functions/`, `supabase/migrations/` ativas) e por inspeção
explícita de `NovoExameDialog.tsx` / `DetalhesExameDialog.tsx` — onde
estavam apenas como defaults do formulário, nunca renderizadas, nunca
lidas fora do próprio cadastro.

| Coluna | Categoria | Justificativa |
|---|---|---|
| `exame_calculado` | morta | Nunca lida; sem render |
| `exame_oculto` | morta | Nunca lida; sem render |
| `tipo_mapa` | morta | Carregada no SLIM mas sem consumidor |
| `temperatura_transporte` | morta-apoio | Pertence ao Provider |
| `protegido_luz` | morta-apoio | Pertence ao Provider |
| `observacoes_coleta` | morta-apoio | Pertence ao Provider |
| `material_apoio` | morta-apoio | Pertence ao Provider |
| `recipiente_apoio` | morta-apoio | Pertence ao Provider |
| `volume_apoio_ml` | morta-apoio | Pertence ao Provider |
| `preparo_apoio` | morta-apoio | Pertence ao Provider |
| `prazo_apoio_dias` | morta-apoio | Pertence ao Provider |
| `exige_protocolo_externo` | morta-apoio | Pertence ao Provider |
| `idade_minima_meses` | morta-clínica | Validação não existe |
| `idade_maxima_meses` | morta-clínica | Validação não existe |
| `urgencia_padrao` | morta | Duplica `urgencia_disponivel` |
| `ordem_coleta` | morta | Sem render; ordenação por nome |
| `ordem_setor` | morta | Sem render |
| `ordem_impressao` | morta | Layout Científico cuida |
| `grupo_impressao` | morta | Layout Científico cuida |
| `template_laudo_id` | morta | Layout Científico cuida (exame_layouts) |
| `texto_interpretativo_padrao` | morta | Layout Científico cuida |

### Colunas mantidas (apesar de listadas na auditoria)

A auditoria contou 25 colunas com "0 consumidores fora do dialog". Destas,
4 **são** renderizadas no `NovoExameDialog` e foram preservadas:

- `codigo_loinc` — input ativo (validação `validarLoinc`)
- `codigo_sus` — input ativo
- `sexo_aplicavel` — select ativo
- `tuss_sem_equivalente` — switch ativo

> Critério literal de "0 consumidores confirmados" — não foram removidos.

### Arquivos / hooks / stores / RPCs órfãos removidos

| Categoria | Quantidade |
|---|---:|
| Componentes órfãos | 0 |
| Hooks órfãos | 0 |
| Stores órfãs | 0 |
| Diálogos órfãos | 0 |
| RPCs órfãs | 0 |
| Triggers redundantes | 0 |

> A auditoria já havia documentado: "Nenhum hook/RPC dedicado a Exames — não
> há órfãos. Todas as 9 stores têm consumidores." Confirmado.

### Imports / constantes mortas removidas

- `SLIM_COLUMNS`: `tipo_mapa` removido (1 token).
- `ExameCatalogo` (TS): 21 propriedades removidas.
- `fromRow` / `toRow`: 42 linhas removidas (mapeamento das colunas mortas).
- `emptyForm` em `NovoExameDialog`: 18 defaults removidos.

---

## 3. Sub-fase B — Interface Engine Readiness

### Colunas adicionadas (3, todas `NULL`able, sem default)

| Coluna | Tipo | Finalidade |
|---|---|---|
| `codigo_interfaceamento` | `text` | Código interno canônico do LIS para integrações |
| `codigo_hl7` | `text` | OBR HL7 (mensageria clínica) |
| `codigo_equipamento` | `jsonb` | Mapa `{equipamento → código}`, p.ex. `{"cobas-c311":"ACUR"}` |

Todas com `COMMENT ON COLUMN` documentando a finalidade.

### Garantias

- Nenhuma constraint nova.
- Nenhuma validação no backend.
- Nenhum driver.
- Nenhum endpoint HL7/ASTM/Worklist.
- TS expõe `codigoInterfaceamento`, `codigoHL7`, `codigoEquipamento` no
  `ExameCatalogo`, prontos para serem populados pela UI/import quando o
  Interface Engine for implementado.

> Spec atendido literalmente: "Preparar a estrutura sem criar dependências."

---

## 4. O que NÃO foi feito (por design)

| Tema | Status |
|---|---|
| Layout Científico (`metodologia`, `unidade_padrao`, `template_laudo_id`) | ❌ Preservado — depende de `metodologia_snapshot`/RDC 786 |
| Material FK (`material` string → `material_id`) | ❌ Preservado — toca Coleta/Atendimento/Soroteca |
| Refator de coleta | ❌ Campos de coleta preservados no catálogo |
| Snapshot regulatório | ❌ Não tocado |

---

## 5. Validação executada

| Verificação | Resultado |
|---|---|
| Migration aplicada | ✅ Sem erros |
| Linter Supabase (pré-existentes) | ⚠️ 167 warnings não relacionados (security definer views/functions herdados) |
| `rg` final por nomes camelCase removidos em `src/` | ✅ 0 ocorrências |
| `rg` final por nomes snake_case removidos em `src/` + `supabase/functions/` | ✅ 0 ocorrências |
| TS build (corrigido após primeira tentativa) | ✅ |

---

## 6. Respostas obrigatórias

| Pergunta | Resposta |
|---|---|
| Quantas colunas existiam antes? | **69** |
| Quantas colunas existem agora? | **51** |
| Quantas colunas mortas foram removidas? | **21** |
| Quantos arquivos órfãos foram removidos? | **0** (não havia) |
| Quantas RPCs órfãs foram removidas? | **0** (não havia) |
| Quantos imports mortos foram removidos? | **1 constante (`tipo_mapa` em `SLIM_COLUMNS`)** + 21 props TS + 42 linhas de mapeamento |
| Campos de interfaceamento adicionados? | ✅ `codigo_interfaceamento`, `codigo_hl7`, `codigo_equipamento` |
| Existe código legado restante? | Apenas o que é **operacionalmente necessário** (metodologia/unidade para snapshot RDC 786; material string para coleta/soroteca). Documentado para fase dedicada. |
| Existe código morto restante? | **Não.** Nenhuma coluna com 0 consumidores. |
| Módulo continua operacional sem regressões? | ✅ Sim. Nada removido tinha consumidor. |

---

## 7. Próximas fases (não executar sem aprovação)

1. **Exames 2.2 — Layout Científico:** mover `metodologia`,
   `unidade_padrao`, `texto_interpretativo_padrao`,
   `exibir_*_laudo`, `template_laudo_id`, `grupo_impressao`,
   `ordem_impressao` para `exame_layouts`. Refator do trigger de snapshot
   regulatório.
2. **Exames 2.3 — Material FK:** `material` (text) → `material_id` (FK
   `materiais_amostra`). Backfill + refator de `atendimento_exames`,
   coleta, etiquetas, soroteca.
3. **Exames 2.4 — Interface Engine:** criar tabelas `equipamentos`,
   `equipamento_exame_map`, `worklist` e drivers ASTM/HL7. Consumir
   `codigo_interfaceamento`, `codigo_hl7`, `codigo_equipamento`.

---

**STOP.** Aguardando aprovação explícita para iniciar Exames 2.2.
