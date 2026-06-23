# Ciclo de Vida do Exame

```
[CADASTRO] → [ATENDIMENTO] → [COLETA] → [PRODUÇÃO] → [RESULTADO] → [FATURAMENTO]
```

## 1. Cadastro
**Tabela:** `exames_catalogo` + satélites (`parametros`, `layouts`, `vr`).
**Campos exigidos:** `nome`, `mnemonico`, `categoria` (setor textual ou
`setor_id`), `tipo_processo`, `material`, `recipiente`.
**Atores:** admin.

## 2. Atendimento
**Lê do exame:** `id`, `nome`, `mnemonico`, `prazo_entrega_dias`,
`tipo_processo`, `lab_apoio_id`, `requer_jejum`, `horas_jejum`,
`sexo_aplicavel`, `setor_id`.
**Lê do preço:** `tabela_preco_itens` via `pricing.ts`.
**Materializa em:** `atendimento_exames` (snapshot por linha).

## 3. Coleta
**Lê do exame:** `material`, `recipiente`, `cor_tampa`, `volume_minimo_ml`,
`grupo_etiquetas`, `quantidade_etiquetas`, `informacoes_coleta`.
**Decisão de roteamento:** `tipo_processo` + `lab_apoio_id` (override em
`RoteamentoApoioPanel`).
**Materializa em:** `amostras` + `coletas`.

## 4. Produção
**Lê do exame:** `setor_id` (para roteirizar na bancada).
**Bancada/Analista NÃO** estão no exame — pertencem ao mapa de trabalho.
**Materializa em:** `mapa_trabalho_itens`.

## 5. Resultado
**Lê do exame:** `id` (para join com `parametros`, `layouts`, `vr`).
**Lê dos satélites:** `exame_parametros`, `exame_layouts`,
`valores_referencia`.
**Snapshot RDC:** congela layout/metodologia/unidade na liberação.

## 6. Faturamento
**Lê do exame:** `codigo_cbhpm`, `codigo_tuss`, `porte_cbhpm`,
`tuss_sem_equivalente`, `codigo_sus`.
**Lê do preço:** `tabela_preco_itens`.

## Diagnóstico
- Campos de **apoio** (`*_apoio`) só são lidos pelo driver de provider — não
  participam do ciclo `atendimento → coleta → produção → resultado`.
- Campos de **laudo** (`exibir_*_laudo`, `texto_interpretativo_padrao`) só
  participam do estágio Resultado → pertencem ao Layout Científico.
- Campos `idade_minima_meses`, `idade_maxima_meses`, `urgencia_padrao`,
  `temperatura_transporte`, `protegido_luz`, `observacoes_coleta`,
  `exame_calculado`, `exame_oculto`, `ordem_coleta`, `ordem_setor`,
  `ordem_impressao`, `grupo_impressao`, `tipo_mapa` — **não participam de
  nenhum estágio do ciclo de vida** (0 consumidores).
