# CKEditor 5 — Relatório de Instalação Oficial

**Data:** 2026-06-14
**Editor oficial do SISLAC:** CKEditor 5 (ClassicEditor, licença `GPL`)
**Substitui:** Antigo `RichTextEditorPro` / TipTap (removidos por completo)

---

## 1. Pacotes instalados

| Pacote | Versão | Origem |
|---|---|---|
| `ckeditor5` | `48.2.0` | oficial — bundle modular com todos os plugins |
| `@ckeditor/ckeditor5-react` | `11.2.0` | oficial — binding React |

> Apenas pacotes **oficiais** do CKEditor 5. Sem builds custom, sem forks.
> Distribuição: `import { ClassicEditor, ... } from "ckeditor5"`
> CSS: `import "ckeditor5/ckeditor5.css"`

---

## 2. Plugins habilitados

`Essentials`, `Paragraph`, `Autoformat`, `Undo`, `ClipboardPipeline`,
`Bold`, `Italic`, `Underline`, `Strikethrough`, `RemoveFormat`,
`Heading` (Parágrafo / H1 / H2 / H3), `BlockQuote`,
`List` (marcadores + numeração, com properties),
`Alignment` (left / center / right / justify),
`Link`, `AutoLink`,
`Image`, `ImageToolbar`, `ImageCaption`, `ImageStyle`, `ImageResize`, `ImageInsert`, `ImageUpload`, `Base64UploadAdapter`,
`Table`, `TableToolbar`, `TableProperties`, `TableCellProperties`, `TableColumnResize`, `TableCaption`,
`PasteFromOffice`,
`GeneralHtmlSupport` (preserva classes/atributos colados),
`SourceEditing`.

---

## 3. Recursos disponíveis (toolbar)

| Categoria | Itens |
|---|---|
| Texto | Negrito, Itálico, Sublinhado, Tachado, Remover formatação |
| Estrutura | Parágrafo, H1, H2, H3, BlockQuote |
| Listas | Marcadores, Numeração (estilos, início, reverso) |
| Alinhamento | Esquerda, Centro, Direita, Justificado |
| Tabelas | Inserir tabela, +linha/+coluna, remover linha/coluna, **mesclar células**, dividir células, propriedades de tabela e célula, legenda, **resize de coluna** |
| Mídia | Imagem (upload Base64, redimensionamento, legenda, alinhamento), Link (com decorator "abrir em nova aba") |
| Clipboard | **Colar do Word, Excel e HTML** via `PasteFromOffice` + `ClipboardPipeline` |
| Avançado | Source editing (HTML direto), Undo/Redo |

---

## 4. Componente oficial

Arquivo: `src/components/editor/CKEditor.tsx`

```ts
interface CKEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
}
```

Tema visual SISLAC (flat, indigo `#4D41F3`, sem sombras) em
`src/components/editor/ckeditor.css`.

---

## 5. Compatibilidade com modelos de laudo / mapas / documentos

- **Variáveis `{{...}}`** (`{{PACIENTE}}`, `{{IDADE}}`, `{{SEXO}}`, `{{EXAME}}`,
  `{{RESULTADO}}`, `{{ASSINATURA}}`, `{{DATA_COLETA}}`, `{{DATA_RESULTADO}}` …):
  preservadas como **texto puro**. CKEditor não escapa, não remove e não altera
  o conteúdo textual; o motor de renderização atual (`renderPlaceholders`) continua
  funcionando sem qualquer adaptação.
- **HTML de saída**: limpo, semântico, compatível com o pipeline existente:
  - `mapaPrint.ts` (impressão A4 de mapas)
  - `documentoRenderer.ts` (templates de documentos)
  - `laudoLayout.ts` / `laudoTemplate.ts` (laudos)
  - Portal do paciente (renderização direta via `dangerouslySetInnerHTML`)
- **Colagem do Word/Excel**: preservada via `PasteFromOffice`. Atributos/classes
  herdados do Word continuam aceitos por causa do `GeneralHtmlSupport` aberto.

---

## 6. Compatibilidade com PDF / impressão

- O HTML gerado é processado pelos mesmos utilitários A4 já em uso
  (`mapaSharedStyles.ts`, classes `prose-mapa` / `a4-sheet` / `a4-stage` em
  `src/index.css`).
- A função `normalizeMapaHtml` (em `src/lib/mapaSharedStyles.ts`) continua
  responsável pela normalização final antes da impressão; ela trabalha sobre
  HTML genérico e independe do editor de origem.
- Print-to-PDF pelo navegador (`window.print()`) funciona sem ajustes
  adicionais. A página de teste (`/admin/ckeditor-test`) inclui botão
  "Imprimir" para validação manual.

---

## 7. Página de validação

Rota protegida: **`/admin/ckeditor-test`**
Arquivo: `src/pages/admin/CKEditorTest.tsx`

Itens validáveis:
- ✅ Editor funcional (carrega ClassicEditor com toda a toolbar)
- ✅ Inserção de tabelas + mesclagem de células
- ✅ Colagem do Word / Excel (via clipboard nativo)
- ✅ Preservação das 8 variáveis oficiais (indicador visual ✓/✗)
- ✅ Preview HTML renderizado lado a lado
- ✅ HTML bruto exibido em `<pre>`
- ✅ Botão "Imprimir" abre janela com o HTML pronto para PDF

---

## 8. Build / TypeScript / Vite

- TypeScript: tipos vêm com `ckeditor5` e `@ckeditor/ckeditor5-react`.
- Vite: sem ajustes em `vite.config.ts` (dedupe antigo do TipTap já removido).
- Bundle: importado via ESM modular padrão (`from "ckeditor5"`).
- Sem warnings de peer-deps relevantes na instalação.

---

## 9. Regra de parada

Conforme briefing: **um único editor oficial**. Não criar versões alternativas,
não tocar em banco/regras/fluxos. Próximas integrações (substituir o
`EditorPlaceholder` em `MapaTrabalhoDialog`, `DocumentoTemplateDialog`,
`LayoutDialog`) devem ser pedidas explicitamente.
