# Project Memory

## Core
Metodologia OFICIAL: OLHOU→ENTENDEU→CONFIGUROU→VALIDOU. Não pular etapas. PARAR ao fim de cada fase; próxima fase exige aprovação explícita.
SSOT por conceito, interface canônica única, simplicidade vence. Antes de adicionar feature: "elimina complexidade existente?" Se não, reavaliar.
Cleanup (código morto, dual-write, flags temporárias) é parte da fase, não tarefa futura. Remover legado só após 100% consumidores migrados.

## Memories
- [Metodologia OECV](mem://preferences/metodologia-olhou-entendeu-configurou-validou) — Ciclo oficial de 4 etapas com regra de parada e critérios obrigatórios
- [Document Engine 3.0 congelado](mem://constraints/document-engine-3.0-congelado) — Motor oficial de documentos; Paged.js isolado em adapters/PagedRenderer.ts; consumir só via renderDocument
