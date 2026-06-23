# Mapa de Domínio — Exames

```
                       ┌────────────────────────┐
                       │   exames_catalogo (SSOT)│
                       └────────────┬────────────┘
                                    │
   ┌────────────┬──────────────┬────┴──────┬──────────────┬─────────────┐
   ▼            ▼              ▼           ▼              ▼             ▼
exame_      exame_       valores_     tabela_       setores_       labs_
parametros  layouts      referencia   preco_itens   laboratoriais  apoio
  (analítico)(científico) (clínico)   (faturamento) (produção)     (apoio)
                                                                       │
                                                              ┌────────┴────────┐
                                                              ▼                 ▼
                                                       provider drivers   atendimento_exames
                                                       (hermes/dbsync)    (operação)
```

## Entidades

### 1. `exames_catalogo`  *(SSOT — identidade)*
- **Cria:** admin via `NovoExameDialog` ou `provider-catalog-import`.
- **Altera:** admin via `NovoExameDialog` / `updateExameCatalogo`.
- **Consome:** TODO o sistema (atendimento, coleta, produção, resultados,
  faturamento, vitrine, mapa).
- **Depende de:** `setores_laboratoriais` (FK setor_id), `labs_apoio` (FK
  lab_apoio_id), `tenants` (FK tenant_id).

### 2. `exame_parametros`  *(analítico)*
- **Cria/altera:** admin via `ParametrosDialog`.
- **Consome:** `ResultadoDetalhe`, validação crítica, exibição no laudo.
- **Depende de:** `exames_catalogo.id`.

### 3. `exame_layouts`  *(científico)*
- **Cria/altera:** admin via `LayoutDialog` (CKEditor 5).
- **Consome:** `ResultadoDetalhe`, impressão, snapshot RDC 786/2023.
- **Depende de:** `exames_catalogo.id`.
- **Regra RDC:** mudança = NOVO layout + NOVO snapshot, nunca editar histórico.

### 4. `valores_referencia`  *(clínico)*
- **Cria/altera:** admin via `MatrizValoresReferencia`.
- **Consome:** `ResultadoDetalhe`, alertas críticos.
- **Depende de:** `exame_nome` + `parametro_nome` (string-based — não é FK).
  ⚠️ Acoplamento frágil — ver `dead-code-report.md › R7`.

### 5. `tabela_preco_itens`  *(faturamento)*
- **Cria/altera:** admin via `TabelasPrecoTab`.
- **Consome:** `pricing.ts`, atendimento, orçamento.
- **Depende de:** `exames_catalogo.id` (FK forte). `nome_exame`/`codigoExame`
  são cache derivado.

### 6. `setores_laboratoriais`  *(produção)*
- **Cria/altera:** admin via `SetoresTab`.
- **Consome:** `exames_catalogo`, mapa de trabalho, agrupamento na coleta.
- **Bancada NÃO está no exame** ✔ — pertence ao mapa de trabalho.

### 7. `materiais_amostra`  *(soroteca)*
- **Cria/altera:** admin em Soroteca > Materiais.
- **Consome:** `amostras.material_id`, etiqueta, retenção.
- **NÃO referenciado pelo `exames_catalogo`** — exame usa string `material`.
  ⚠️ Duplicação de domínio. Ver `collection-audit.md`.

### 8. `labs_apoio`  *(apoio)*
- **Cria/altera:** admin via `LabsApoioTab`.
- **Consome:** `exames_catalogo.lab_apoio_id`, roteamento.
- **Depende de:** `tenants`.
