# Soroteca — Catálogo de Materiais

## Tabela `materiais_amostra`
Criada em `migration 20260622223230_0ef07884` com seed de 8 materiais (Soro, Plasma, Sangue Total, Urina, Fezes, Swab, Líquor, Secreção).
- Trigger `sync_amostra_tipo_material_biu` em `amostras` propaga `material_id` para o texto livre `tipo_material` (uppercase do nome).
- Trigger `audit_materiais_amostra` envia mudanças para `audit_logs`.
- UNIQUE em `lower(nome) per tenant`.

## SSOT — análise
- `amostras.material_id` (FK nullable) é o **campo canônico**.
- `amostras.tipo_material` (texto legado) é mantido por compatibilidade — populado automaticamente pelo trigger.
- Pesquisa avançada filtra por `material_id` (`sorotecaStore.ts:471`).

## Listas hardcoded remanescentes
1. **`MATERIAIS_NAO_REUTILIZAVEIS = new Set(["URINA","FEZES","ESCARRO","SECRECAO"])`** em `sorotecaStore.ts:39-44`.
   - Deveria consultar `materiais_amostra.reutilizavel` (a coluna existe, ver `materiaisAmostraStore.ts`).
   - Hoje ignora a configuração do banco — divergência silenciosa se um material novo for marcado como não reutilizável.
2. **Array `MATERIAIS`** em `src/pages/Producao.tsx` — lista paralela com `"Líquor"` / `"Secreção"`, não integrada ao catálogo.

## Enums locais
Nenhum enum SQL — todos os status são `text` validados por `CHECK` constraint.

## Conclusão
O catálogo está implementado e auditado, mas **não é 100% SSOT** enquanto `MATERIAIS_NAO_REUTILIZAVEIS` e a lista em `Producao.tsx` existirem.
