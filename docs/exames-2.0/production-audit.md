# Auditoria — Produção

## O que o exame conhece sobre produção
- `setor_id` (FK para `setores_laboratoriais`) ✔
- `categoria` (string textual — legado, redundante com setor)

## O que o exame **NÃO** conhece (correto)
- Bancada → pertence ao mapa de trabalho.
- Analista → atribuído por turno, não pelo cadastro.
- Equipamento → pertence ao Interface Engine (futuro).

## Diagnóstico
- ✔ Acoplamento **adequado** — exame só precisa saber o setor para roteirizar.
- ⚠ `categoria` (texto) coexiste com `setor_id` (FK) → fonte dupla de verdade.
  Migrações antigas usavam `categoria`, hoje `setor_id` é canônico.
  `resolveSetorIdByNome()` no `setoresLaboratoriaisStore` faz a ponte.
- ⚠ `tipo_mapa` no catálogo é **legado** — o tipo do mapa é decidido pelo
  setor / layout, não pelo exame. 0 leituras.

## Recomendação
1. Deprecate `categoria` em favor de `setor_id` (já em curso).
2. Remover `tipo_mapa` do catálogo.
3. Manter `setor_id` como única referência operacional de produção.
