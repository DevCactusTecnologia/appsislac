# SSOT — Documentos do SISLAC

Verificação de Single Source of Truth para cada eixo do domínio documental.

## 1. Branding institucional (logo + razão + CNPJ + endereço)

- **SSOT existente:** `getLabConfig()` em `src/data/labConfigStore.ts`.
- **Quem usa:** `buildEmitenteHeader` (comprovantes/orçamento), templates
  configuráveis (laudo, comprovantes via `documentoRenderer`).
- **Quem ignora:** Mapa, Etiqueta, LGPD, Auditoria, Financeiro (Livro Caixa,
  Detalhado, Detalhe de Entrada), Tabelas de Preço, Catálogo de Exames,
  Produção, Dossiê de Rastreabilidade.
- **Status: SSOT existe mas é seguido por minoria.** ⚠️

## 2. HTML do header/rodapé

- **Candidato a SSOT:** `buildEmitenteHeader` + `buildAssinaturaRodape` em
  `src/domains/result/services/comprovantesHtml.ts`.
- **Estado real:** **11 cabeçalhos paralelos** (ver `duplication-report.md`).
- **Status: SSOT não consolidado.** ❌

## 3. CSS de impressão (`@page`, `body`, tabela A4)

- **SSOT existente:** apenas para Mapa de Trabalho via
  `mapaSharedStyles.buildPrintCss`.
- **Estado real:** ~10 blocos `<style>@page…</style>` inline, copiados.
- **Status: SSOT inexistente para a maioria.** ❌

## 4. Motor de impressão (HTML → impressora/PDF)

- **SSOT existente:** `printHtmlInHiddenFrame` em `src/lib/printHtml.ts`.
- **Estado real:** quase tudo passa por ele (✅). Excepções legítimas:
  `comprovantesRender.ts` (orçamento PDF/WhatsApp) e laudo legado
  (`html2pdf.js`).
- **Status: SSOT consolidado.** ✅

## 5. Helpers utilitários

| Helper | SSOT existe? | Seguido? |
|--------|:------------:|:--------:|
| `escapeHtml` | ✅ `@/lib/escapeHtml.ts` | ❌ (6 cópias locais) |
| `fmtBRL` | ✅ `@/lib/utils.ts` | ✅ |
| `renderPlaceholders` | ✅ `@/lib/mapaPlaceholders.ts` | ✅ (onde aplicável) |
| `codigoVerificacao` | ✅ `comprovantesValidation.ts` | ✅ |
| Formatação de data BR | ❌ | ❌ (4 variantes) |

## 6. Templates configuráveis (Configurações → Documentos)

- **SSOT existente:** `documento_templates` (DB) + `renderDocumentoTemplate`.
- **Cobre:** comprovante de pagamento, comprovante de atendimento, declaração
  de comparecimento, orçamento, cabeçalho, rodapé.
- **Não cobre:** laudo (apenas cabeçalho/rodapé), mapa, financeiro, LGPD,
  auditoria, tabelas, produção, etiqueta, dossiê.
- **Status: SSOT parcial (cobertura ~30% dos documentos).** ⚠️

## 7. Validação legal / código de verificação

- **SSOT existente:** `comprovantesValidation.ts`
  (`validarLaboratorioParaComprovante`, `codigoVerificacao`).
- **Página pública:** `/verificar/:codigo` (`VerificarComprovante.tsx`).
- **Status: SSOT consolidado.** ✅

## 8. Camada de upload + WhatsApp

- **SSOT existente:** `comprovantesUpload.ts` + `comprovantesWhatsapp.ts`
  (edge functions + shortlinks).
- **Único cliente real hoje:** Orçamento.
- **Status: SSOT consolidado, embora subutilizado.** ✅

## Sumário

| Eixo | SSOT? | Aderência |
|------|:----:|-----------|
| Motor de impressão | ✅ | Alta |
| Helper `fmtBRL` / placeholders / verificação | ✅ | Alta |
| Branding (`getLabConfig`) | ✅ | **Baixa** |
| Header/footer canônico | ✅ | **Baixa** |
| Templates configuráveis | ⚠️ | Parcial |
| CSS de impressão | ❌ | — |
| `escapeHtml` / `fmtData` | ❌ | — |

O sistema **tem SSOT onde importa para correção** (motor, validação,
branding-data) e **falta SSOT onde importa para identidade visual**
(header HTML, CSS de impressão, helpers de formatação).
