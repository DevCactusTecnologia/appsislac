// Editor oficial do SISLAC — CKEditor 5 (licença GPL).
// Idioma: Português do Brasil (pt-BR).
// Recursos: fontes, cor de texto, cor de fundo, realce, e barra flutuante
// de formatação que aparece com clique direito (e na seleção de texto).

import type { ReactNode } from "react";
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

export interface CKEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  orientation?: "portrait" | "landscape";
  toolbarRight?: ReactNode;
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
  value, onChange, disabled, placeholder, orientation = "portrait", toolbarRight,
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
          "fontFamily", "fontSize", "fontColor", "fontBackgroundColor", "highlight", "|",
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
        "fontColor", "fontBackgroundColor", "highlight", "|",
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
        allow: [{ name: /.*/, attributes: true, classes: true, styles: true }],
      },
    }),
    [placeholder],
  );

  return (
    <div className="sislac-ckeditor" data-orientation={orientation}>
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
          // Clique direito abre a barra flutuante de formatação.
          const root = editor.editing.view.getDomRoot();
          if (root) {
            root.addEventListener("contextmenu", (ev) => {
              ev.preventDefault();
              try {
                const balloon = editor.plugins.get("BalloonToolbar") as
                  | { show: (showForCollapsedSelection?: boolean) => void }
                  | undefined;
                balloon?.show(true);
              } catch {
                /* noop */
              }
            });
          }
        }}
        onChange={(_evt, editor) => {
          onChange(editor.getData());
        }}
      />
    </div>
  );
};

export default CKEditorComponent;
