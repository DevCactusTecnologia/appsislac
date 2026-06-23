# Auditoria — Faturamento

## Campos do catálogo que pertencem ao faturamento
- `codigo_cbhpm`, `porte_cbhpm`
- `codigo_tuss`, `tuss_sem_equivalente`
- `codigo_sus`
- `codigo_loinc` (regulatório, neutro)

## Tabelas envolvidas
- `tabela_preco_itens` (441 linhas) — preço por tabela (CBHPM/TUSS/Própria).
- `convenios` + `convenio_exames` — vínculo convênio↔preço.

## Diagnóstico
- ✔ **Identidade regulatória** (códigos) pertence ao catálogo — é parte da
  identidade do exame, não do preço.
- ✔ **Preço** está separado em `tabela_preco_itens` — fonte única, com FK
  para `exames_catalogo.id`.
- ⚠ `tuss_sem_equivalente` tem **0 leituras** — flag persistida e nunca
  consultada. Decidir: usar em export TISS ou remover.
- ⚠ `porte_cbhpm` é usado em 3 lugares (pricing, tabela, snapshot) — OK.
- ✔ Catálogo **não** carrega valor — bom.

## Pergunta-chave
> "O exame precisa conhecer faturamento?"

**Resposta:** Apenas a identidade regulatória (códigos). Valor e regra de
cobrança ficam fora.

## Recomendação
1. Manter: `codigo_cbhpm`, `porte_cbhpm`, `codigo_tuss`, `codigo_sus`,
   `codigo_loinc`.
2. Remover: `tuss_sem_equivalente` (ou implementar consumo no export TISS).
3. Não introduzir nenhum campo de preço no catálogo.
