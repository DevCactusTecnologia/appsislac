# 03 — Single Responsibility

## Método
Inspeção estrutural (diretórios, nomes, LOC) + confronto com auditoria fase-02.

## Evidências

### Alta aderência a SRP
- `src/data/*Store.ts` — 1 arquivo por entidade (48 arquivos).
- `src/domains/**/services/*` — cada arquivo = 1 serviço puro (pricing, comprovantes, critico, VR).
- `src/lib/` — formatters, validators, print-engine subdivididos por função.
- `supabase/functions/_shared/*` — cada módulo = 1 preocupação (runtime, drivers, s3, crypto, rateLimit, integrationLog).
- `src/components/ui/*` — primitivos shadcn isolados.
- `src/hooks/*` — cada hook uma responsabilidade nomeada.

### Acúmulo de responsabilidades (evidência = LOC + escopo)
| Arquivo | LOC | Sinais de múltiplas responsabilidades |
|---|---:|---|
| src/pages/ResultadoDetalhe.tsx | 3129 | Renderização + hidratação + fórmula + auditoria dupla + impressão + histórico |
| src/pages/NovoAtendimento.tsx | 2829 | Cadastro + pricing + pagamento + exames + orçamento |
| src/pages/Financeiro.tsx | 1149 | Múltiplas abas financeiras em um arquivo |
| src/pages/superadmin/SuperAdminTenantDetalhe.tsx | 1259 | Detalhe + configs + operações administrativas |
| src/components/configuracoes/ExamesTab.tsx | 976 | Listagem + edição + subcomponentes |
| src/components/PagamentoDialog.tsx | 892 | UI + orquestração de pagamentos + PIX + impressão |
| src/data/sorotecaStore.ts | 830 | Múltiplos casos de uso de soroteca |

- `NovoAtendimento/` e `ResultadoDetalhe/` já iniciaram extração para subpasta (`services/`, `helpers.ts`, `formula.ts`) — SRP parcial.

## Conclusão factual
- ~85% dos arquivos são SRP simples.
- ~15% concentram múltiplas responsabilidades — todos identificáveis por LOC > 800 e escopo funcional heterogêneo.
