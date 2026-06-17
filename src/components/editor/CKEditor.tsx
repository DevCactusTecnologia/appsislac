// Editor oficial do SISLAC — CKEditor 5 (licença GPL).
// Idioma: Português do Brasil (pt-BR).
// Recursos: fontes, cor de texto, cor de fundo, realce, e barra flutuante
// de formatação que aparece com clique direito (e na seleção de texto).

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor,
  type EditorConfig,
  Alignment,
  Autoformat,
  AutoLink,
  BalloonToolbar,
  Base64UploadAdapter,
  BlockQuote,
  Bold,
  ClipboardPipeline,
  Essentials,
  FontBackgroundColor,
  FontColor,
  FontFamily,
  FontSize,
  GeneralHtmlSupport,
  Heading,
  Highlight,
  HorizontalLine,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Indent,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  Underline,
  Undo,
} from "ckeditor5";
// Traduções oficiais pt-BR.
import ptBrTranslations from "ckeditor5/translations/pt-br.js";

import "ckeditor5/ckeditor5.css";
import "./ckeditor.css";

export interface CKEditorApi {
  insertHtml: (html: string) => void;
  focus: () => void;
}

export interface CKEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  orientation?: "portrait" | "landscape";
  toolbarRight?: ReactNode;
  onEditorReady?: (api: CKEditorApi) => void;
  /** Margens internas da "folha" (em mm). Default 10mm em todos os lados. */
  marginsMm?: { top: number; right: number; bottom: number; left: number };
}

const FONT_FAMILIES = [
  "default",
  "Inter, system-ui, sans-serif",
  "Arial, Helvetica, sans-serif",
  "Calibri, sans-serif",
  "Georgia, serif",
  "Times New Roman, Times, serif",
  "Courier New, Courier, monospace",
  "Verdana, Geneva, sans-serif",
  "Tahoma, Geneva, sans-serif",
  "Trebuchet MS, sans-serif",
  "Lucida Sans Unicode, sans-serif",
  "Comic Sans MS, cursive",
  "Roboto, sans-serif",
  "Open Sans, sans-serif",
  "Montserrat, sans-serif",
  "Poppins, sans-serif",
  "Lato, sans-serif",
];

const FONT_SIZES = [9, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

const CKEditorComponent = ({
  value, onChange, disabled, placeholder, orientation = "portrait", toolbarRight, onEditorReady, marginsMm,
}: CKEditorProps) => {
  const config = useMemo<EditorConfig>(
    () => ({
      licenseKey: "GPL" as const,
      language: "pt-br",
      translations: [ptBrTranslations],
      placeholder,
      plugins: [
        Essentials, Paragraph, Autoformat, Undo, ClipboardPipeline,
        Bold, Italic, Underline, Strikethrough, Subscript, Superscript, RemoveFormat,
        FontFamily, FontSize, FontColor, FontBackgroundColor, Highlight,
        Heading, BlockQuote, HorizontalLine,
        List, Indent, Alignment,
        Link, AutoLink,
        Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageInsert, ImageUpload, Base64UploadAdapter,
        Table, TableToolbar, TableProperties, TableCellProperties, TableColumnResize, TableCaption,
        PasteFromOffice, GeneralHtmlSupport, SourceEditing,
        BalloonToolbar,
      ],
      toolbar: {
        items: [
          "undo", "redo", "|",
          "heading", "|",
          "fontFamily", "fontSize", "fontColor", "fontBackgroundColor", "|",
          "bold", "italic", "underline", "strikethrough", "subscript", "superscript", "removeFormat", "|",
          "bulletedList", "numberedList", "outdent", "indent", "|",
          "alignment", "|",
          "link", "insertImage", "insertTable", "blockQuote", "horizontalLine", "|",
          "sourceEditing",
        ],
        shouldNotGroupWhenFull: true,
      },
      // Barra flutuante (aparece na seleção e no clique direito).
      balloonToolbar: [
        "fontFamily", "fontSize", "|",
        "bold", "italic", "underline", "strikethrough", "|",
        "fontColor", "fontBackgroundColor", "|",
        "alignment", "|",
        "bulletedList", "numberedList", "|",
        "link", "removeFormat",
      ],
      fontFamily: { options: FONT_FAMILIES, supportAllValues: true },
      fontSize: { options: FONT_SIZES, supportAllValues: true },
      fontColor: { columns: 6, documentColors: 12 },
      fontBackgroundColor: { columns: 6, documentColors: 12 },
      heading: {
        options: [
          { model: "paragraph", title: "Parágrafo", class: "ck-heading_paragraph" },
          { model: "heading1" as const, view: "h1", title: "Título 1", class: "ck-heading_heading1" },
          { model: "heading2" as const, view: "h2", title: "Título 2", class: "ck-heading_heading2" },
          { model: "heading3" as const, view: "h3", title: "Título 3", class: "ck-heading_heading3" },
        ],
      },
      list: { properties: { styles: true, startIndex: true, reversed: true } },
      alignment: { options: ["left" as const, "center" as const, "right" as const, "justify" as const] },
      link: {
        defaultProtocol: "https://",
        decorators: {
          openInNewTab: {
            mode: "manual" as const,
            label: "Abrir em nova aba",
            attributes: { target: "_blank", rel: "noopener noreferrer" },
          },
        },
      },
      image: {
        toolbar: [
          "imageTextAlternative", "toggleImageCaption",
          "imageStyle:inline", "imageStyle:block", "imageStyle:side",
          "resizeImage",
        ],
      },
      table: {
        contentToolbar: [
          "tableColumn", "tableRow", "mergeTableCells",
          "tableProperties", "tableCellProperties",
          "toggleTableCaption",
        ],
      },
      htmlSupport: {
        // Allowlist restrita: blocos de formatação/estrutura usados em laudos,
        // mapas e documentos. NÃO inclui <script>, <iframe>, <object>,
        // <embed>, <form> ou atributos de evento (on*). Para evitar XSS
        // armazenado, qualquer conteúdo gerado aqui também passa por
        // sanitizeHtml() antes de ser renderizado.
        allow: [
          {
            name: /^(p|div|span|section|article|header|footer|main|aside|h[1-6]|blockquote|hr|br|pre|code|em|strong|b|i|u|s|sub|sup|small|mark|ul|ol|li|dl|dt|dd|figure|figcaption|img|a|table|thead|tbody|tfoot|tr|th|td|caption|colgroup|col)$/i,
            attributes: /^(class|style|colspan|rowspan|align|valign|width|height|src|alt|title|href|target|rel|data-[\w-]+|id|lang|dir)$/i,
            classes: true,
            styles: true,
          },
        ],
        disallow: [
          { name: /^(script|iframe|object|embed|form|input|button|select|textarea|link|meta|base|svg|math)$/i },
          { attributes: /^on/i },
        ],
      },
    }),
    [placeholder],
  );

  const sheetStyle = marginsMm
    ? ({
        "--sislac-pad-top": `${marginsMm.top}mm`,
        "--sislac-pad-right": `${marginsMm.right}mm`,
        "--sislac-pad-bottom": `${marginsMm.bottom}mm`,
        "--sislac-pad-left": `${marginsMm.left}mm`,
      } as CSSProperties)
    : undefined;

  return (
    <div className="sislac-ckeditor" data-orientation={orientation} style={sheetStyle}>
      {toolbarRight && (
        <div className="sislac-ckeditor__toolbar-right">
          {toolbarRight}
        </div>
      )}
      <CKEditor
        editor={ClassicEditor}
        data={value ?? ""}
        disabled={disabled}
        config={config}
        onReady={(editor) => {
          const root = editor.editing.view.getDomRoot();
          if (!root) return;

          // Expor API imperativa (inserir HTML / foco) para botões externos.
          onEditorReady?.({
            insertHtml: (html: string) => {
              try {
                const viewFragment = editor.data.processor.toView(html);
                const modelFragment = editor.data.toModel(viewFragment);
                editor.model.insertContent(modelFragment);
                editor.editing.view.focus();
              } catch {
                /* noop */
              }
            },
            focus: () => editor.editing.view.focus(),
          });


          // ============================================================
          // Post-fixer: garante unidade 'px' em altura/largura de células
          // e linhas. CKEditor às vezes salva apenas o número, o que faz
          // o navegador ignorar o estilo. Roda em toda mudança de modelo.
          // ============================================================
          editor.model.document.registerPostFixer((writer) => {
            let changed = false;
            const NUMERIC = /^\d+(\.\d+)?$/;
            const attrs = ["tableCellHeight", "tableCellWidth", "tableRowHeight"] as const;
            const root = editor.model.document.getRoot();
            if (!root) return false;
            const range = writer.createRangeIn(root);
            for (const { item } of range) {
              for (const attr of attrs) {
                const v = item.getAttribute(attr);
                if (typeof v === "string" && NUMERIC.test(v.trim())) {
                  writer.setAttribute(attr, `${v.trim()}px`, item);
                  changed = true;
                }
              }
            }
            return changed;
          });

          // ============================================================
          // Aplica "line-height" nos blocos selecionados via GHS.
          // ============================================================
          const applyLineHeight = (value: string | null) => {
            editor.model.change((writer) => {
              const sel = editor.model.document.selection;
              const blocks = Array.from(sel.getSelectedBlocks());
              for (const block of blocks) {
                const tagMap: Record<string, string> = {
                  paragraph: "htmlPAttributes",
                  heading1: "htmlH1Attributes",
                  heading2: "htmlH2Attributes",
                  heading3: "htmlH3Attributes",
                  heading4: "htmlH4Attributes",
                  listItem: "htmlLiAttributes",
                };
                const attrName = tagMap[block.name] || "htmlPAttributes";
                const existing = (block.getAttribute(attrName) as { styles?: Record<string, string> } | undefined) || {};
                const styles = { ...(existing.styles || {}) };
                if (value === null) delete styles["line-height"];
                else styles["line-height"] = value;
                writer.setAttribute(attrName, { ...existing, styles }, block);
              }
            });
            editor.editing.view.focus();
          };

          const closeMenu = () => {
            document
              .querySelectorAll(".sislac-ck-ctx-menu")
              .forEach((el) => el.remove());
          };

          const runCmd = (name: string, value?: unknown) => {
            try {
              editor.execute(name, value as never);
              editor.editing.view.focus();
            } catch {
              /* noop */
            }
            closeMenu();
          };

          type Item =
            | { sep: true }
            | { label: string; cmd: string; value?: unknown; danger?: boolean };

          const buildMenu = (items: Item[], x: number, y: number) => {
            closeMenu();
            const menu = document.createElement("div");
            menu.className = "sislac-ck-ctx-menu";
            menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999;`;
            items.forEach((it) => {
              if ("sep" in it) {
                const s = document.createElement("div");
                s.className = "sislac-ck-ctx-sep";
                menu.appendChild(s);
                return;
              }
              const btn = document.createElement("button");
              btn.type = "button";
              btn.textContent = it.label;
              btn.className = "sislac-ck-ctx-item" + (it.danger ? " is-danger" : "");
              btn.addEventListener("click", (e) => {
                e.preventDefault();
                runCmd(it.cmd, it.value);
              });
              menu.appendChild(btn);
            });
            document.body.appendChild(menu);

            // Ajusta posição se sair da viewport.
            requestAnimationFrame(() => {
              const r = menu.getBoundingClientRect();
              if (r.right > window.innerWidth) {
                menu.style.left = `${window.innerWidth - r.width - 8}px`;
              }
              if (r.bottom > window.innerHeight) {
                menu.style.top = `${window.innerHeight - r.height - 8}px`;
              }
            });

            const onDocClick = (ev: MouseEvent) => {
              if (!menu.contains(ev.target as Node)) {
                closeMenu();
                document.removeEventListener("mousedown", onDocClick, true);
                document.removeEventListener("keydown", onKey, true);
              }
            };
            const onKey = (ev: KeyboardEvent) => {
              if (ev.key === "Escape") {
                closeMenu();
                document.removeEventListener("mousedown", onDocClick, true);
                document.removeEventListener("keydown", onKey, true);
              }
            };
            document.addEventListener("mousedown", onDocClick, true);
            document.addEventListener("keydown", onKey, true);
          };

          // Evita que o right-click colapse a seleção (inclui multi-seleção de células)
          // antes do nosso menu de contexto. Preserva a seleção atual do editor.
          root.addEventListener(
            "mousedown",
            (ev) => {
              if (ev.button !== 2) return;
              const t = ev.target as HTMLElement | null;
              if (t?.closest("table")) {
                ev.preventDefault();
                ev.stopPropagation();
              }
            },
            true,
          );

          root.addEventListener("contextmenu", (ev) => {
            const target = ev.target as HTMLElement | null;
            const inTable = !!target?.closest("table");
            ev.preventDefault();

            if (inTable) {
              // Garante seleção dentro da célula clicada antes de mostrar.
              const tableItems: Item[] = [
                { label: "Inserir linha acima", cmd: "insertTableRowAbove" },
                { label: "Inserir linha abaixo", cmd: "insertTableRowBelow" },
                { label: "Inserir coluna à esquerda", cmd: "insertTableColumnLeft" },
                { label: "Inserir coluna à direita", cmd: "insertTableColumnRight" },
                { sep: true },
                { label: "Mesclar células selecionadas", cmd: "mergeTableCells" },
                { label: "Dividir célula horizontalmente", cmd: "splitTableCellHorizontally" },
                { label: "Dividir célula verticalmente", cmd: "splitTableCellVertically" },
                { sep: true },
                { label: "Cabeçalho desta linha", cmd: "setTableRowHeader" },
                { label: "Cabeçalho desta coluna", cmd: "setTableColumnHeader" },
                { sep: true },
                { label: "Propriedades da célula", cmd: "tableCellProperties" },
                { label: "Propriedades da tabela", cmd: "tableProperties" },
                { sep: true },
                { label: "Excluir linha", cmd: "removeTableRow", danger: true },
                { label: "Excluir coluna", cmd: "removeTableColumn", danger: true },
                { label: "Excluir tabela", cmd: "removeTable", danger: true },
              ];
              buildMenu(tableItems, ev.clientX, ev.clientY);
              return;
            }

            // Fora de tabela: barra de formatação flutuante.
            try {
              const balloon = editor.plugins.get("BalloonToolbar") as
                | { show: (showForCollapsedSelection?: boolean) => void }
                | undefined;
              balloon?.show(true);
            } catch {
              /* noop */
            }
          });
        }}
        onChange={(_evt, editor) => {
          onChange(editor.getData());
        }}
      />
    </div>
  );
};

export default CKEditorComponent;
