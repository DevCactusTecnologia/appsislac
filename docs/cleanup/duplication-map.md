# Cleanup — Phase 4: Mapa de Duplicação

## Helpers de formatação

- `src/lib/format.ts` — 0 importadores.
- `src/lib/utils.ts`, `src/lib/idade.ts`, `src/lib/masks.ts` — em uso.

Fonte canônica: `utils.ts` (+ helpers específicos por domínio). `format.ts`
parece ser resíduo de um helper genérico anterior. **Candidato a remoção.**

## Status badges

- `src/components/shared/StatusBadge.tsx` — 0 importadores.
- Cada domínio mantém seu próprio badge (Atendimento, Resultado, Coleta,
  Financeiro) usando a tabela de cores semânticas (`STATUS_PAGAMENTO_TYPES`
  etc.). Conforme regra de UI Flat já fixada em memória, não há fonte
  canônica genérica desejada. **Candidato a remoção.**

## Toolbar

- `src/components/shared/Toolbar.tsx` — 0 importadores. Cada página usa
  toolbar local construída com componentes shadcn diretamente. **Candidato
  a remoção.**

## Date Picker

- `src/components/ui/date-picker.tsx` — 0 importadores. Datas no projeto
  usam `<Input type="date">` ou componentes específicos. **Candidato.**

## Card / Command (shadcn)

- `src/components/ui/card.tsx`, `src/components/ui/command.tsx` — 0
  importadores no momento. São primitives do shadcn. **Atenção:** a regra
  geral do projeto é manter primitives shadcn instalados, mas como nenhuma
  feature ativa os usa, classifico como **REVISAR** (não “SEGURO”) —
  remoção possível mas pode encurtar futura DX.

## Provider Hermes-Pardini

- `services/verificarRecebimento.service.ts`, `transports/http.transport.ts`,
  `transports/index.ts` — 0 consumidores diretos. Toda a feature parece
  estar em desenvolvimento (apenas `mock.transport` é referenciado).
  Classificado **REVISAR** (provavelmente WIP intencional).

## Domain service duplicado

- `src/domains/result/services/ParameterRulesService.ts` — 0 importadores.
  Provavelmente foi planejado mas a lógica vive em
  `valoresReferenciaStore` + `parseValorReferencia`. Classificado
  **REVISAR**.
