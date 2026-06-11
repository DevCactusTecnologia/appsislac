# Critical Flows — Single Source of Truth (Consolidado)
> Audit date: 2025-07 | Read-only

Consolidação dos achados de SSOT dos 5 módulos auditados. Detalhes por módulo em
`docs/audits/<modulo>/<modulo>-single-source-of-truth.md`.

## Matriz de duplicações

| # | Item | Locais | Tipo | Risco |
|---|------|--------|------|-------|
| 1 | Cálculo de preço de exame | (consolidado) `NovoAtendimento/pricing.ts`; cálculo legado ainda em `Financeiro.tsx:264` | Cálculo | 🟠 Alto |
| 2 | Construção `examesCobranca` | (consolidado) `NovoAtendimento/buildExamesCobranca.ts` | Payload | 🟢 Baixo |
| 3 | Templates de mensagem WhatsApp | `comprovantes.ts:1052,1111`, `PdfPreviewDialog.tsx` | Texto | 🟠 Alto |
| 4 | Normalização de telefone (+55) | `whatsapp-send/index.ts:32`, `comprovantes.ts:1026` | Validação | 🟡 Médio |
| 5 | Enum modo WhatsApp | TS alias + Postgres ENUM + string no edge fn | Tipo | 🟡 Médio |
| 6 | Resolução de faixa etária (referência clínica) | `reguasEtariasStore`, `valores_referencia`, helpers em `ResultadoDetalhe/helpers.ts` | Regra clínica | 🟠 Alto |
| 7 | Cálculo de fatura de convênio | `Financeiro.tsx` + `convenioFaturasStore.ts` | Cálculo | 🟠 Alto |
| 8 | Geração de código de verificação (FNV-1a) | `comprovantes.ts:160` (único) | Hash | 🟢 Baixo |
| 9 | URL assinada / shortlink TTL | edge `comprovante-resolve` (24h) vs Storage signed (1h) | Configuração | 🟡 Médio |
| 10 | Verificação de role super_admin | edge `super-admin-*` (server) + flag client em `SuperAdminPrefsContext` | Auth | 🟠 Alto |

## Classificação

- 🟢 Baixo: 2 itens — já consolidados ou triviais.
- 🟡 Médio: 3 itens — duplicação tolerável, padronizar quando tocar.
- 🟠 Alto: 5 itens — recomendar hardening dedicado.

## Recomendações (não-bloqueantes)

1. Mover `calculateExamPrice` para `src/lib/financeiro/pricing.ts` e fazer `Financeiro.tsx` consumir.
2. Criar tabela `whatsapp_templates` por tenant e renderizar server-side.
3. Extrair `phoneUtils` compartilhado (frontend + edge).
4. Gerar tipos do enum `whatsapp_modo` automaticamente.
5. Unificar resolução de faixa etária em `src/lib/referenciaClinica.ts`.
6. Centralizar cálculo de fatura em um único helper.
7. Alinhar TTL de shortlink ao TTL da URL assinada (ou re-presign on resolve).
8. Remover qualquer flag client-side para gating de UI super_admin; manter só server-side.
