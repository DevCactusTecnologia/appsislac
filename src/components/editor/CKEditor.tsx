// Editor oficial do SISLAC — CKEditor 5 (licença GPL).
// Único editor de texto rico do sistema; substitui o antigo RichTextEditorPro.
//
// Compatibilidade obrigatória:
//   • Preserva placeholders {{...}} (PACIENTE, IDADE, SEXO, EXAME, RESULTADO,
//     ASSINATURA, DATA_COLETA, DATA_RESULTADO etc.) sem escapar/remover.
//   • Saída em HTML limpo, pronta para impressão / PDF / Portal do Paciente.

import { useMemo } from "react";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import {
  ClassicEditor,
  type EditorConfig,
  Alignment,
  Autoformat,
  AutoLink,
  Base64UploadAdapter,
  BlockQuote,
  Bold,
  ClipboardPipeline,
  Essentials,
  GeneralHtmlSupport,
  Heading,
  Image,
  ImageCaption,
  ImageInsert,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  RemoveFormat,
  SourceEditing,
  Strikethrough,
  Table,
  TableCaption,
  TableCellProperties,
  TableColumnResize,
  TableProperties,
  TableToolbar,
  Underline,
  Undo,
} from "ckeditor5";

import "ckeditor5/ckeditor5.css";
import "./ckeditor.css";

export interface CKEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Orientação da folha A4 simulada na área de edição. Default: portrait. */
  orientation?: "portrait" | "landscape";
}

const CKEditorComponent = ({ value, onChange, disabled, placeholder }: CKEditorProps) => {
  // Config memoizada — recriar a cada render destrói o editor.
  const config = useMemo<EditorConfig>(
    () => ({
      // Licença GPL pública (sem custo) para projetos open-source / internos.
      licenseKey: "GPL" as const,
      placeholder,
      plugins: [
        Essentials, Paragraph, Autoformat, Undo, ClipboardPipeline,
        Bold, Italic, Underline, Strikethrough, RemoveFormat,
        Heading, BlockQuote,
        List, Alignment,
        Link, AutoLink,
        Image, ImageToolbar, ImageCaption, ImageStyle, ImageResize, ImageInsert, ImageUpload, Base64UploadAdapter,
        Table, TableToolbar, TableProperties, TableCellProperties, TableColumnResize, TableCaption,
        PasteFromOffice,
        GeneralHtmlSupport,
        SourceEditing,
      ],
      toolbar: {
        items: [
          "undo", "redo",
          "|",
          "heading",
          "|",
          "bold", "italic", "underline", "strikethrough", "removeFormat",
          "|",
          "bulletedList", "numberedList",
          "|",
          "alignment",
          "|",
          "link", "insertImage", "insertTable", "blockQuote",
          "|",
          "sourceEditing",
        ],
        shouldNotGroupWhenFull: true,
      },
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
      // Mantém o HTML colado do Word/Excel o mais fiel possível,
      // permitindo classes/estilos comuns sem rejeitar o conteúdo.
      htmlSupport: {
        allow: [
          {
            name: /.*/,
            attributes: true,
            classes: true,
            styles: true,
          },
        ],
      },
    }),
    [placeholder],
  );

  return (
    <div className="sislac-ckeditor">
      <CKEditor
        editor={ClassicEditor}
        data={value ?? ""}
        disabled={disabled}
        config={config}
        onChange={(_evt, editor) => {
          // Placeholders {{...}} são texto puro — CKEditor preserva sem alterar.
          onChange(editor.getData());
        }}
      />
    </div>
  );
};

export default CKEditorComponent;
