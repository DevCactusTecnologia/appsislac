# Exames 2.0 — Relatório Executivo (Fase 1)

> **Status:** Auditoria 100% leitura. Nenhum arquivo de produção alterado.
> **Escopo:** módulo de Exames de ponta a ponta — cadastro, coleta, produção,
> apoio, interfaceamento, resultados, faturamento, UX, performance, código morto.
> **Filosofia:** "Olhou. Entendeu. Resolveu." O cadastro deve servir à operação,
> não à burocracia.

---

## 1. Resumo em uma página

| Dimensão | Diagnóstico | Severidade |
|---|---|---|
| **SSOT** | `public.exames_catalogo` (441 linhas) é a fonte única do catálogo. ✔ | OK |
| **Tabelas satélite** | 8 tabelas vivem ao redor do exame (params, layouts, VR, preço, setor, material, apoio, atendimento). Sem duplicação estrutural relevante. | OK |
| **Campos no catálogo** | **64 colunas** em `exames_catalogo`. ~38 % nunca são lidos fora do próprio formulário de cadastro. | 🔴 Alto |
| **Acoplamento com Apoio** | 9 colunas duplicam dados que pertencem ao provider de apoio (`material_apoio`, `recipiente_apoio`, `volume_apoio_ml`, `preparo_apoio`, `prazo_apoio_dias`, `codigo_exame_apoio`, `provider_integracao`, `exige_protocolo_externo`, `permite_envio_apoio`). | 🟠 Médio |
| **Acoplamento com Layout Científico** | 5 colunas pertencem ao Layout, não ao exame (`metodologia`, `unidade_padrao`, `texto_interpretativo_padrao`, `exibir_*_laudo`). Já existe nota oficial em `exameLayoutsStore.ts` confirmando o split. | 🟠 Médio |
| **Acoplamento com Faturamento** | Catálogo carrega `codigo_cbhpm`, `codigo_tuss`, `porte_cbhpm`, `tuss_sem_equivalente`, `codigo_sus`, `codigo_loinc`. Faz sentido manter (identidade regulatória), mas hoje `tabela_preco_itens` espelha `codigo_exame` denormalizado. | 🟡 Baixo |
| **Preparação para interfaceamento** | **Inexistente** como conceito formal. Não há `codigo_interfaceamento`, `codigo_equipamento`, `codigo_hl7`, `codigo_lis`. O campo `codigo_exame_apoio` é o único proxy. | 🔴 Alto |
| **UX** | `NovoExameDialog` foi recentemente simplificado (3 seções principais + colapsáveis) — boa nota. Porém ainda existem ~40 campos persistidos invisíveis na UI. | 🟢 Bom |
| **Segurança / RLS** | Todas as tabelas têm RLS + 4 policies (read auth / admin write). `setor_id` em RLS via tenant. ✔ | OK |
| **Performance** | Two-tier cache implementado no store (slim no boot, full on-demand). 11 índices em `exames_catalogo`. Sem N+1 detectado em listagens. | 🟢 Bom |
| **Código morto** | 25 colunas do catálogo sem consumidor fora do diálogo de cadastro. 0 RPC dedicado a exames. | 🟠 Médio |

---

## 2. Veredito por pergunta-chave

1. **Qual é a SSOT dos exames?** → `public.exames_catalogo`. ✔
2. **Quais campos são obrigatórios?** → 6: `nome`, `mnemonico`, `tenant_id`,
   `ativo`, `tipo_processo`, `analise`. Operacionalmente o usuário precisa
   também de `setor_id` (ou `categoria`), `material`, `recipiente`.
3. **Quais são legado?** → bloco `*_apoio` duplicado, `tipo_mapa`,
   `tuss_sem_equivalente`, `codigo` (separado de `mnemonico`),
   `exibir_*_laudo`, `template_laudo_id`.
4. **Quais não possuem consumidores?** → 25 colunas listadas em
   `dead-code-report.md`.
5. **Quais pertencem ao Layout Científico?** → `metodologia`,
   `unidade_padrao`, `texto_interpretativo_padrao`,
   `exibir_metodologia_laudo`, `exibir_unidade_laudo`,
   `exibir_material_laudo`, `template_laudo_id`, `grupo_impressao`,
   `ordem_impressao`.
6. **Preparado para interfaceamento?** → **Não.** Falta um eixo
   `codigo_interfaceamento` / `codigo_equipamento` / `loinc` consumido.
7. **Acoplamento com Faturamento?** → Médio. Os códigos regulatórios são
   identidade do exame (OK), mas valores e tabela pertencem a
   `tabela_preco_itens` (já separado).
8. **Acoplamento com Produção?** → Baixo. Setor é referência por `setor_id`,
   bancada NÃO está no catálogo (correto). ✔
9. **Cadastro simples ou poluído?** → A UI já foi simplificada (boa), mas o
   **schema** ainda é poluído.
10. **Como transformar Exames em módulo enxuto?** → ver
    `executive-report.md › seção 4 (Recomendações)` abaixo.

---

## 3. Princípio organizador proposto

```
EXAME                = identidade operacional + regulatória + roteamento
LAYOUT CIENTÍFICO    = como o resultado é produzido e apresentado
PARÂMETROS           = quais campos formam o resultado
VR / RÉGUAS          = qual é normal por sexo/idade
TABELA DE PREÇO      = quanto custa por convênio
PROVIDER DE APOIO    = como envia para terceiros
INTERFACE ENGINE     = como conversa com equipamentos (futuro)
```

Tudo que escapar desses sete cilindros é candidato a remoção/migração.

---

## 4. Recomendações (a serem aplicadas na Fase 2 — após aprovação)

| # | Ação | Tipo | Risco |
|---|---|---|---|
| R1 | Mover `metodologia`, `unidade_padrao`, `texto_interpretativo_padrao`, `exibir_*_laudo`, `template_laudo_id`, `grupo_impressao`, `ordem_impressao` para `exame_layouts.config` | Migration | 🟠 |
| R2 | Remover bloco `*_apoio` duplicado (delegar ao provider via `codigo_exame_apoio` + driver) | Migration | 🟠 |
| R3 | Remover `tipo_mapa`, `tuss_sem_equivalente`, `exame_calculado`, `exame_oculto`, `ordem_coleta`, `ordem_setor`, `idade_minima_meses`, `idade_maxima_meses`, `urgencia_padrao`, `tags`, `temperatura_transporte`, `protegido_luz`, `observacoes_coleta` | Migration | 🟢 |
| R4 | Introduzir `codigo_interfaceamento` (text) + `codigo_equipamento` (jsonb) preparando Interface Engine | Migration | 🟢 |
| R5 | Consolidar coleta no Layout Científico (material/tubo/jejum/volume migrados como defaults referenciáveis, mas editáveis no Layout) | Refactor | 🟠 |
| R6 | Gerar view `vw_exame_operacional` projetando apenas as 12 colunas usadas em listagens (substitui SLIM_COLUMNS hardcoded) | View | 🟢 |

---

## 5. Critério de sucesso (para fase de implementação)

Ao final do redesenho, o cadastro de um exame deve ter no máximo **18 campos**
distribuídos em 3 seções:

1. **Identidade** — nome, mnemônico, setor, sexo, ativo
2. **Coleta padrão** — material, recipiente, jejum, volume, instruções
3. **Roteamento & Códigos** — tipo (interno/apoio), lab apoio, código apoio,
   CBHPM, TUSS, LOINC, código interfaceamento

Tudo o mais → Layout Científico, Provider de Apoio ou Tabela de Preço.

---

## 6. Próxima fase

**AGUARDAR APROVAÇÃO EXPLÍCITA.** Nenhuma migração, refactor ou remoção
acontece sem o "sim" do dono do produto.
