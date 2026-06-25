---
name: Metodologia OECV (Olhou • Entendeu • Configurou • Validou)
description: Ciclo oficial obrigatório para toda evolução do SISLAC — 4 etapas sequenciais sem pular fases, com regra de parada e aprovação explícita entre fases
type: preference
---

# Metodologia Oficial SISLAC: OLHOU • ENTENDEU • CONFIGUROU • VALIDOU

Toda evolução do SISLAC segue rigorosamente este ciclo. Nenhuma fase pula etapas.
Objetivos: código enxuto, arquitetura simples, zero regressão, evolução contínua, alta confiabilidade.

## ETAPA 1 — OLHOU (Radiografia)
Antes de alterar qualquer linha, mapear: banco, frontend, backend, stores, hooks, componentes, integrações, fluxos, consumidores, SSOT, legado, código morto, duplicações, riscos.
**Saída obrigatória:** Radiografia completa. **Nenhuma alteração nesta etapa.**

## ETAPA 2 — ENTENDEU (Análise baseada em evidências)
Responder com evidências (nunca suposições): Como funciona hoje? Quem consome/escreve/lê? Existe duplicação/código morto/legado/complexidade desnecessária? Existe oportunidade de simplificação? Resolve problema real ou carrega decisões antigas?

## ETAPA 3 — CONFIGUROU (Implementação)
Princípios obrigatórios:
- **Simplicidade**: solução mais simples vence.
- **SSOT**: uma fonte de verdade por conceito. Nunca dupla manutenção.
- **Interface Canônica**: um fluxo principal. Sem duas formas de configurar a mesma coisa sem necessidade comprovada.
- **Compatibilidade**: dual-read/dual-write/fallback durante migrações; remover legado só após validação.
- **Banco**: criar/remover tabelas, colunas, índices, FKs, normalizar — com ganho comprovado.
- **Código**: remover/criar componentes, stores, helpers, hooks, serviços — se reduzir complexidade.
- **UX**: "usuário novo entende em <1 min?" Se não, simplificar.

## ETAPA 4 — VALIDOU (Validação completa)
Obrigatório: build, typecheck, lint, testes automatizados, smoke test manual, validação funcional, fluxo completo.
**Ciclo completo** (ex: Cadastro → Config → Execução → Resultado → Impressão → Auditoria). Nunca validar telas isoladas.

### Regressão
Antes de remover legado, confirmar: 100% consumidores migrados, zero imports/referências/fallbacks restantes.

### Cleanup final da fase
Remover: código morto, órfãos, helpers temporários, migrations transitórias, feature flags temporárias, dual-write/read, comentários temporários. Sem rastros.

## Governança
Nenhuma decisão por "sempre foi assim". Toda decisão responde: torna o SISLAC mais simples / intuitivo / rápido / seguro / fácil de manter? Se algum "não", reavaliar.

## Critérios obrigatórios por fase
Código mais simples, menos duplicação, menos arquivos, menos complexidade, menos cliques, menos regras implícitas, menos legado, mais consistência, mais rastreabilidade, zero regressão.

## REGRA DE PARADA (crítica)
Ao finalizar uma fase: **PARAR**. Entregar: relatório técnico, alterações realizadas, riscos, validações executadas, impactos, pendências.
**Nenhuma próxima fase inicia automaticamente. Toda próxima fase exige aprovação explícita do usuário.**

## Princípio fundamental
Antes de adicionar funcionalidade: "Ela elimina uma complexidade existente?" SIM → implementar. NÃO → reavaliar.

## Como aplicar
- Anunciar a etapa atual (OLHOU/ENTENDEU/CONFIGUROU/VALIDOU) no início de cada resposta de fase.
- Não pular para CONFIGUROU sem entregar OLHOU+ENTENDEU.
- Não iniciar nova fase sem "ok"/"aprovado"/"siga" explícito.
- Cleanup é parte da fase, não tarefa futura.
