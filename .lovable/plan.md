# Document Service do SISLAC — PDF real via Browserless (isolado)

Objetivo: gerar PDF real no backend usando o HTML que já é montado hoje (laudoHtmlBuilder + Layout Científico + cabeçalho + rodapé + marca d'água), abrindo `application/pdf` inline em nova aba. Sem reescrever templates. Browserless tratado como **detalhe de implementação trocável**.

## Arquitetura (camadas, do alto para o baixo)

```text
UI (botão Imprimir)
   │  window.open(pdfUrl, "_blank")
   ▼
Document Service (edge function: document-render)
   │  recebe { kind: "laudo", payload: { atendimentoId, exameIds, ... } }
   │  monta HTML via builders existentes (server-side)
   │  delega ao PdfRenderer
   ▼
PdfRenderer (interface)  ──►  BrowserlessRenderer (única implementação hoje)
                              POST {BROWSERLESS_URL}/pdf  +  token
   ▼
Response: application/pdf + Content-Disposition: inline; filename="..."
```

Pontos-chave:
- O Document Service é **genérico** (`kind` discrimina o documento). Laudo é o primeiro caso; mapa de trabalho, comprovantes, etc., entram depois sem nova função.
- **Nada no app fala com Browserless.** Quem fala é só `PdfRenderer`. Trocar para Gotenberg/Chromium próprio = trocar 1 arquivo.
- O HTML do laudo é o **mesmo** que já alimenta o iframe hoje — não reescrevemos `laudoHtmlBuilder.ts` nem o Layout Científico.

## O que será criado

1. **Edge function `document-render`** (`supabase/functions/document-render/index.ts`):
   - Valida JWT, resolve tenant, valida payload (Zod).
   - Roteia por `kind`. Para `kind: "laudo"`: chama `buildLaudoHtml(payload)` (server-side, replicando o que o front faz hoje — mesmas queries, mesmos templates, mesmo CSS de impressão).
   - Passa o HTML + opções (`format: A4`, `margin`, `printBackground: true`, `preferCSSPageSize: true`) para `PdfRenderer.render(html, opts)`.
   - Devolve `Response(pdfBytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="laudo-<protocolo>.pdf"' } })`.

2. **`PdfRenderer` interface + `BrowserlessRenderer`** (dentro da edge, em arquivos separados via `import_map` ou inline no `index.ts` se Lovable Cloud preferir flat):
   - `interface PdfRenderer { render(html: string, opts: PdfOptions): Promise<Uint8Array> }`.
   - `BrowserlessRenderer` faz `POST ${BROWSERLESS_URL}/pdf?token=${TOKEN}` com `{ html, options: { format:"A4", printBackground:true, preferCSSPageSize:true, margin:{...} } }`.
   - Erros do Browserless viram 502 com mensagem clara.

3. **Frontend — botão Imprimir** (`src/pages/ResultadoDetalhe.tsx`):
   - Substitui `printHtmlInHiddenFrame` por:
     ```ts
     const url = `${SUPABASE_URL}/functions/v1/document-render?kind=laudo&atendimentoId=...&exameIds=...&token=<short-lived>`;
     window.open(url, "_blank", "noopener,noreferrer");
     ```
   - Nova aba abre direto o PDF no viewer nativo do Chrome (igual Laravel). Aba do laudo não trava.
   - Para autenticação: a edge function aceita Bearer JWT no header **ou** um `token` curto na query (assinado pelo backend, TTL 60s) — necessário porque `window.open` não envia headers customizados.

4. **Secrets** (vou pedir via `add_secret` depois que você confirmar a plataforma):
   - `BROWSERLESS_URL` (ex.: `https://chrome.browserless.io` ou self-hosted)
   - `BROWSERLESS_TOKEN`
   - Se for outro serviço (Gotenberg etc.), me diga e ajusto o `BrowserlessRenderer` antes de pedir secrets.

## O que será removido / mantido

Mantém intacto:
- `laudoHtmlBuilder.ts`, `laudoLayout.ts`, `layoutScientificRuntime.ts`, `printShell.ts`, `watermark.ts`, todo o CSS `@page` e rodapé já congelados.
- O fluxo iframe atual continua existindo como **fallback** (caso Browserless caia, botão cai para `printHtmlInHiddenFrame`).

Removido:
- Nada do Paged.js a mais (já foi removido na rodada anterior).

## Detalhes técnicos importantes

- **Reuso do builder no Deno:** `laudoHtmlBuilder` hoje vive em `src/` (browser). Para a edge function, vou extrair as funções puras (montagem de HTML a partir de dados) para um módulo isomórfico ou duplicar minimamente a montagem dentro de `supabase/functions/document-render/laudo.ts` consumindo o **mesmo CSS string** e os **mesmos placeholders**. Os layouts vindos do banco (`exame_layouts.conteudo`) e os parâmetros (`exame_parametros`) são lidos via supabase client server-side — exatamente as mesmas tabelas que o front já lê.
- **CSS de página:** mantido como está hoje (`@page { size: A4; margin: ... }`, rodapé 4mm congelado). Browserless respeita `preferCSSPageSize: true`.
- **Marca d'água:** continua via `body::before` / classe `.watermark` definida no `printShell` atual.
- **Performance:** chamada Browserless típica 500ms–2s. Aceitável; abrimos com `target=_blank` então usuário vê o tab loading.

## Riscos e mitigação

- **Browserless fora do ar** → fallback automático para iframe (`window.print()`), com toast "PDF service indisponível, usando impressão local".
- **Custo do Browserless** → começa em ~US$ 50/mês; alternativa zero-custo é Gotenberg self-hosted (mesma interface no `PdfRenderer`, só muda 1 arquivo).
- **Layouts customizados no CKEditor** → renderizam exatamente igual pois o HTML enviado ao Chromium é o mesmo que renderiza no navegador hoje.

## Pergunta antes de codar

Confirma **Browserless.io** como provider (eu peço `BROWSERLESS_URL` + `BROWSERLESS_TOKEN` via `add_secret`), ou prefere outro serviço/Gotenberg self-hosted (me passe a URL pública)?
