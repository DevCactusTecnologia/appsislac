## Objetivo

Substituir o atual fluxo de impressão (Paged.js + rota `/resultado/:id/print` + nova aba) por **geração de PDF real no backend**, no mesmo modelo do Laravel: o botão "Imprimir" chama uma URL → o backend devolve um arquivo `.pdf` pronto → o navegador abre/baixa direto, sem travar a aba original.

## Decisão técnica que preciso confirmar antes de codar

Edge Functions do Lovable Cloud rodam em **Deno (sem Chromium pré-instalado)**. Para gerar um PDF "igual ao Laravel" (HTML → PDF com cabeçalho, rodapé, margens, marca d'água), há 3 caminhos possíveis. **Escolha um antes que eu implemente:**

### Opção A — Gotenberg / Browserless (Chromium remoto via HTTP) — **recomendada**
- Edge function `laudo-pdf` monta o HTML do laudo (cabeçalho/rodapé/marca d'água via CSS `@page`) e faz `POST` para um serviço de Chromium hospedado (Gotenberg self-hosted, Browserless.io ou similar).
- Recebe o PDF binário pronto, devolve `application/pdf`.
- **Prós:** fidelidade visual idêntica ao Laravel (wkhtmltopdf/Chromium), suporta `@page`, headers/footers nativos, marca d'água, paginação automática perfeita.
- **Contras:** depende de **1 secret** (URL/API key do serviço). Custo do serviço (Browserless ~ US$ 50/mês; Gotenberg self-hosted = grátis se você tiver onde rodar).

### Opção B — `pdf-lib` puro no edge (sem Chromium)
- Construo o PDF "à mão" com `pdf-lib` (desenha texto, tabelas, linhas, imagens).
- **Prós:** zero dependência externa, zero custo, 100% backend.
- **Contras:** **não renderiza HTML**. Significa **reescrever todos os templates científicos** (Hemograma, Bioquímica, layouts CKEditor do usuário, fórmulas, tabelas dinâmicas) em código de desenho PDF. Trabalho enorme e qualquer template novo criado pelo usuário no CKEditor precisaria de migração manual.

### Opção C — Manter HTML + iframe oculto (fluxo "que funcionava antes") e tratar isto como o "PDF real"
- Remove Paged.js, remove rota `/print`, volta 100% ao `printHtmlInHiddenFrame` que já existe e funcionava.
- O "PDF" continua sendo gerado pelo `window.print()` → "Salvar como PDF" do Chrome.
- **Prós:** zero novo backend, zero dependência, resolve imediatamente os 4 problemas reportados (nova aba, aba travada, Paged.js bagunçado, layout quebrado).
- **Contras:** não é um endpoint `/laudo.pdf` igual ao Laravel — continua dependendo do navegador para materializar o PDF. Mas é o que **realmente funcionava antes** e o que o usuário descreveu como "perfeito".

## O que será feito em **todas as opções** (cirurgia comum)

1. **Remover Paged.js do caminho do laudo:**
   - Apagar `LaudoPrintPage.tsx`, remover rota `/resultado/:id/print` em `src/App.tsx`, remover `savePrintContext` do `ResultadoDetalhe.tsx`.
   - Tirar a dependência `pagedjs` do `package.json`.
   - Apagar `src/domains/print/document-engine/adapters/PagedRenderer.ts` e `DocumentRenderer.ts` (ou neutralizar — o constraint "DOCUMENT ENGINE 3.0 — CORE CONGELADO" precisa ser **revogado**, e quero seu OK explícito porque o constraint é uma regra dura do projeto).
2. **Botão "Imprimir" simplificado:**
   - Sempre via fluxo único (não há mais `useNewTab`).
   - Sem abrir aba nova, sem travar a aba do laudo.
3. **Atualizar memory:** remover `mem://constraints/document-engine-3.0-congelado.md` e adicionar nota explicando a nova arquitetura.

## O que muda **conforme a opção escolhida**

- **A:** crio a edge function `laudo-pdf` (POST `{ atendimentoId, exameIds, solicitante? }` → retorna PDF). Botão chama `supabase.functions.invoke` com `responseType: blob`, abre via `URL.createObjectURL` em nova aba (não trava porque é só um download). Preciso do secret `PDF_RENDER_URL` (+ `PDF_RENDER_TOKEN` se Browserless) — pedirei via `add_secret`.
- **B:** crio a edge function `laudo-pdf` com `pdf-lib`. **Aviso de risco:** os layouts CKEditor atuais não vão sair iguais — vou entregar um template padrão por tipo de exame (resultado tabular + cabeçalho/rodapé/marca d'água) e os layouts customizados ficam para uma segunda fase.
- **C:** só faço a parte comum acima. Fim.

## Pergunta direta

Qual opção? **A (recomendada, requer secret e provavelmente custo)**, **B (puro backend mas perde layouts customizados)**, ou **C (volta ao que funcionava antes, sem backend)**?

Sem sua resposta não dá para implementar — escolher por você significa ou (A) gastar seus créditos com um secret que talvez você não queira, ou (B) quebrar os layouts CKEditor que você já configurou, ou (C) entregar algo que não é "PDF real no backend" como você pediu.