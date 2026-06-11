import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, BubbleMenu, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Paragraph from "@tiptap/extension-paragraph";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Extension, Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import type { Node as PMNode } from "@tiptap/pm/model";
import DOMPurify from "dompurify";
import {
  Bold, Italic, Underline as UnderlineIcon,
  AlignLeft, AlignCenter, AlignRight,
  Table as TableIcon, Trash2, Plus, Minus, Variable, Type, ChevronDown,
  Palette, PaintBucket, Columns, Rows,
  Undo2, Redo2, Settings2, Code2,
  Subscript as SubscriptIcon, Superscript as SuperscriptIcon,
  Quote, Code as CodeIcon, SplitSquareHorizontal, SplitSquareVertical,
  Combine, Eraser, ChevronRight, Image as ImageIcon, Upload, Link2, Maximize2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PLACEHOLDERS, type PlaceholderDef } from "@/lib/mapaPlaceholders";

// ─── FontSize extension (não vem no starter-kit) ────────────────────────────
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el: HTMLElement) => el.style.fontSize?.replace(/['"]+/g, "") || null,
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs.fontSize) return {};
              return { style: `font-size: ${attrs.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => any }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as any;
  },
});

// ─── Style attribute helpers (persistem no documento ProseMirror) ───────────
// Sem isso, alterações de border/background em <td>/<tr>/<table> são apagadas
// no próximo re-render do TipTap.
// Helpers de estilo / sanitização e helpers de células TipTap foram extraídos
// para ./RichTextEditorPro/* (Sprint 1). Comportamento idêntico.
import {
  mergeStyleString,
  styleStringToMap,
  cssColorToHex,
  filterStyle,
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOWED_STYLE_PROPS,
} from "./RichTextEditorPro/styleUtils";
import {
  findCellAt,
  findTableAround,
  getCellRowCol,
  mergeCellDirection,
  splitCellDirection,
} from "./RichTextEditorPro/tableCellHelpers";

const styleAttribute = {
  style: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute("style") || null,
    renderHTML: (attrs: Record<string, unknown>) => {
      if (!attrs.style) return {};
      return { style: attrs.style as string };
    },
  },
};

const TableCellWithStyle = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute };
  },
});
const TableHeaderWithStyle = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute };
  },
});
const TableRowWithStyle = TableRow.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute };
  },
});
const TableWithStyle = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute };
  },
});

const DivWithStyle = TiptapNode.create({
  name: "div",
  group: "block",
  content: "block*",
  defining: true,
  addAttributes() {
    return { ...styleAttribute };
  },
  parseHTML() {
    return [{ tag: "div" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});

const ParagraphWithStyle = Paragraph.extend({
  addAttributes() {
    return { ...this.parent?.(), ...styleAttribute };
  },
});


/**
 * Normaliza o HTML para o formato aceito pelo motor de impressão A4:
 *  - Remove <div>, <p>, <h*>, <ul>, <ol>, <li> (mantendo o texto envolto em <span>)
 *  - Restringe atributos e propriedades CSS
 *  - Garante que cada <td>/<th> tenha o conteúdo dentro de <span>
 */
export function normalizeMapaHtml(html: string): string {
  if (!html || typeof html !== "string") return "";

  // 1) DOMPurify com whitelist
  let cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
    ADD_DATA_URI_TAGS: ["img"],
  });

  if (typeof DOMParser === "undefined") return cleaned;

  // 2) Pós-processamento DOM: filtra style, promove alinhamento e garante <span> em células
  const doc = new DOMParser().parseFromString(`<div>${cleaned}</div>`, "text/html");
  const root = doc.body.firstElementChild;
  if (!root) return cleaned;

  // Filtra style props
  root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const filtered = filterStyle(el.getAttribute("style") || "");
    if (filtered) el.setAttribute("style", filtered);
    else el.removeAttribute("style");
  });

  // Garante que conteúdo de <td>/<th> esteja envolto em <span>, preservando
  // estilos autorais de blocos do TipTap (especialmente text-align em <p>).
  root.querySelectorAll<HTMLElement>("td, th").forEach((cell) => {
    const alignedChild = cell.querySelector<HTMLElement>('[style*="text-align"]');
    const childAlign = alignedChild?.style.textAlign;
    if (childAlign && !cell.style.textAlign) {
      cell.setAttribute("style", mergeStyleString(cell.getAttribute("style"), { "text-align": childAlign }));
    }

    cell.querySelectorAll<HTMLElement>("p, div, h1, h2, h3, h4, h5, h6, ul, ol, li").forEach((el) => {
      const span = doc.createElement("span");
      Array.from(el.attributes).forEach((attr) => span.setAttribute(attr.name, attr.value));
      while (el.firstChild) span.appendChild(el.firstChild);
      // Preserva quebra visual entre blocos irmãos dentro da mesma célula
      // (ex.: várias linhas de variáveis no cabeçalho). Sem isto, todos os
      // <p> viram <span> e são depois concatenados em uma única linha.
      const hasNextBlockSibling = !!el.nextElementSibling;
      el.replaceWith(span);
      if (hasNextBlockSibling) {
        const br = doc.createElement("br");
        span.after(br);
      }
    });

    // Se já tem apenas um span, OK
    const onlyChild = cell.children.length === 1 ? cell.firstElementChild : null;
    if (onlyChild?.tagName === "SPAN" && cell.childNodes.length === 1) return;

    // Se vazia, deixa intacta
    if (!cell.textContent?.trim() && cell.children.length === 0) return;

    const span = doc.createElement("span");
    while (cell.firstChild) span.appendChild(cell.firstChild);
    cell.appendChild(span);
  });

  // Garante table-layout: fixed em tabelas
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    const style = table.getAttribute("style") || "";
    if (!/table-layout\s*:/i.test(style)) {
      table.setAttribute(
        "style",
        `${style ? style + "; " : ""}width: 100%; table-layout: fixed`
      );
    }
  });

  return root.innerHTML;
}

// ─── Toolbar widgets ────────────────────────────────────────────────────────
const FONT_FAMILIES = [
  { label: "Inter (padrão)", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, sans-serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Verdana", value: "Verdana, sans-serif" },
];
const FONT_SIZES = ["10px", "11px", "12px", "13px", "14px", "16px", "18px", "20px", "24px", "28px"];
const LINE_HEIGHTS = ["1", "1.15", "1.25", "1.4", "1.5", "1.75", "2", "2.5", "3"];
const PRESET_COLORS = [
  "#000000", "#374151", "#6B7280", "#9CA3AF",
  "#EF4444", "#F59E0B", "#10B981", "#3B82F6",
  "#4D41F3", "#8B5CF6", "#EC4899", "#FFFFFF",
];

const ToolbarBtn = ({
  active, disabled, onClick, title, children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    disabled={disabled}
    title={title}
    aria-pressed={active}
    className={`h-8 min-w-8 px-1.5 rounded-md text-[12px] font-medium flex items-center justify-center gap-1 transition-colors duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
      active
        ? "bg-primary/10 text-primary hover:bg-primary/15"
        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-border/70 mx-1" aria-hidden />;

/**
 * ToolbarGroup — cluster visual de botões relacionados.
 * Cria a sensação de "chips" agrupados (Notion / Word moderno) ao invés
 * de uma fileira plana de ícones separados por linhas verticais.
 */
const ToolbarGroup = ({
  children,
  label,
  className = "",
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) => (
  <div
    role="group"
    aria-label={label}
    className={`inline-flex items-center gap-0.5 rounded-md bg-muted/40 ring-1 ring-border/40 p-0.5 ${className}`}
  >
    {children}
  </div>
);

const ColorPicker = ({
  icon, title, current, onPick, onClear,
}: {
  icon: React.ReactNode;
  title: string;
  current?: string;
  onPick: (hex: string) => void;
  onClear: () => void;
}) => {
  const [custom, setCustom] = useState(current || "#000000");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          title={title}
          className="h-8 px-1.5 rounded-md text-foreground hover:bg-muted flex items-center gap-1"
        >
          {icon}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">{title}</p>
        <div className="grid grid-cols-6 gap-1">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              className="h-6 w-6 rounded border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="color"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-7 w-9 rounded border border-border bg-background cursor-pointer"
          />
          <input
            type="text"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
          />
          <button
            type="button"
            onClick={() => onPick(custom)}
            className="h-7 px-2 text-[11px] rounded bg-primary text-primary-foreground"
          >
            OK
          </button>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="mt-2 w-full h-7 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted"
        >
          Remover cor
        </button>
      </PopoverContent>
    </Popover>
  );
};

const ImageMenu = ({ editor }: { editor: Editor }) => {
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const insertUrl = () => {
    const u = url.trim();
    if (!u) return;
    editor.chain().focus().setImage({ src: u }).run();
    setUrl("");
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("Imagem muito grande (máx. 3 MB).");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      if (src) editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          title="Inserir imagem"
          className="h-8 px-1.5 rounded-md flex items-center gap-1 transition-colors text-foreground hover:bg-muted"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-3" align="start">
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Inserir imagem</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full h-8 rounded-md border border-border hover:bg-muted text-[12px] flex items-center justify-center gap-1.5"
        >
          <Upload className="h-3.5 w-3.5" /> Enviar do computador
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={onFile}
        />
        <div className="my-3 h-px bg-border" />
        <label className="text-[11px] text-foreground flex items-center gap-1">
          <Link2 className="h-3 w-3" /> URL da imagem
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertUrl(); } }}
          placeholder="https://..."
          className="mt-1 w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
        />
        <button
          type="button"
          onClick={insertUrl}
          disabled={!url.trim()}
          className="mt-2 w-full h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50"
        >
          Inserir por URL
        </button>
        <p className="mt-2 text-[10px] text-muted-foreground">PNG, JPG, WEBP, GIF ou SVG. Máx. 3 MB.</p>
      </PopoverContent>
    </Popover>
  );
};

// ─── Image com width/height redimensionáveis ───────────────────────────────
const ImageWithSize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("width") || el.style.width || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.width ? { width: attrs.width as string } : {},
      },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute("height") || el.style.height || null,
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.height ? { height: attrs.height as string } : {},
      },
    };
  },
});

const ImageSizeMenu = ({ editor }: { editor: Editor }) => {
  const active = editor.isActive("image");
  const attrs = active ? (editor.getAttributes("image") as { width?: string | number; height?: string | number; src?: string }) : {};
  const [w, setW] = useState<string>("");
  const [h, setH] = useState<string>("");
  const [lockRatio, setLockRatio] = useState<boolean>(true);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setW(attrs.width != null ? String(attrs.width).replace("px", "") : "");
    setH(attrs.height != null ? String(attrs.height).replace("px", "") : "");
  }, [attrs.width, attrs.height, active]);

  // Carrega a proporção natural da imagem para permitir resize proporcional.
  useEffect(() => {
    if (!active || !attrs.src) { setRatio(null); return; }
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = String(attrs.src);
  }, [attrs.src, active]);

  const apply = (width: string | null, height: string | null) => {
    editor.chain().focus().updateAttributes("image", { width, height }).run();
  };

  const setPreset = (pct: number) => apply(`${pct}%`, null);
  const setAuto = () => apply(null, null);

  const onChangeW = (val: string) => {
    setW(val);
    if (lockRatio && ratio && val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) setH(String(Math.round(num / ratio)));
    } else if (!val) {
      setH("");
    }
  };
  const onChangeH = (val: string) => {
    setH(val);
    if (lockRatio && ratio && val) {
      const num = parseFloat(val);
      if (!isNaN(num) && num > 0) setW(String(Math.round(num * ratio)));
    } else if (!val) {
      setW("");
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          disabled={!active}
          title={active ? "Dimensões da imagem" : "Selecione uma imagem para redimensionar"}
          className={`h-8 px-1.5 rounded-md flex items-center gap-1 transition-colors ${
            active ? "text-foreground hover:bg-muted" : "text-muted-foreground/40 cursor-not-allowed"
          }`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="start">
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
          Dimensões da imagem
        </p>

        <button
          type="button"
          onClick={setAuto}
          className="w-full h-8 rounded-md border border-border hover:bg-muted text-[12px] mb-2"
        >
          Automático (tamanho original)
        </button>

        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Preset (largura)</p>
        <div className="grid grid-cols-4 gap-1 mb-3">
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className="h-7 rounded border border-border hover:bg-muted text-[11px]"
            >
              {p}%
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Manual (px)</p>
          <label className="flex items-center gap-1.5 text-[10px] text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lockRatio}
              onChange={(e) => setLockRatio(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            Manter proporção
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex-1 text-[11px]">
            <span className="text-muted-foreground">Largura</span>
            <input
              type="number"
              min={1}
              value={w}
              onChange={(e) => onChangeW(e.target.value)}
              placeholder="auto"
              className="mt-0.5 w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
            />
          </label>
          <label className="flex-1 text-[11px]">
            <span className="text-muted-foreground">Altura</span>
            <input
              type="number"
              min={1}
              value={h}
              onChange={(e) => onChangeH(e.target.value)}
              placeholder="auto"
              className="mt-0.5 w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => apply(w ? `${w}px` : null, h ? `${h}px` : null)}
          className="mt-2 w-full h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold"
        >
          Aplicar dimensões
        </button>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Com "Manter proporção" ativo, alterar largura ou altura ajusta o outro eixo automaticamente.
        </p>
      </PopoverContent>
    </Popover>
  );
};

const TableMenu = ({ editor }: { editor: Editor }) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const inTable = editor.isActive("table");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          title="Tabela"
          className={`h-8 px-1.5 rounded-md flex items-center gap-1 transition-colors ${
            inTable ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
          }`}
        >
          <TableIcon className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-3" align="start">
        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Inserir tabela</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-foreground">
            Linhas
            <input
              type="number"
              min={1}
              max={20}
              value={rows}
              onChange={(e) => setRows(Math.max(1, Math.min(20, +e.target.value || 1)))}
              className="mt-1 w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
            />
          </label>
          <label className="text-[11px] text-foreground">
            Colunas
            <input
              type="number"
              min={1}
              max={12}
              value={cols}
              onChange={(e) => setCols(Math.max(1, Math.min(12, +e.target.value || 1)))}
              className="mt-1 w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run()
          }
          className="mt-3 w-full h-8 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold"
        >
          Inserir
        </button>

        {inTable && (
          <>
            <div className="my-3 h-px bg-border" />
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Editar</p>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="h-7 rounded border border-border hover:bg-muted flex items-center justify-center gap-1"
              >
                <Columns className="h-3 w-3" /> +Coluna
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="h-7 rounded border border-border hover:bg-muted flex items-center justify-center gap-1"
              >
                <Columns className="h-3 w-3" /> -Coluna
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="h-7 rounded border border-border hover:bg-muted flex items-center justify-center gap-1"
              >
                <Rows className="h-3 w-3" /> +Linha
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="h-7 rounded border border-border hover:bg-muted flex items-center justify-center gap-1"
              >
                <Rows className="h-3 w-3" /> -Linha
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().mergeCells().run()}
                className="h-7 rounded border border-border hover:bg-muted col-span-1"
              >
                Mesclar
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().splitCell().run()}
                className="h-7 rounded border border-border hover:bg-muted col-span-1"
              >
                Dividir
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="h-7 rounded border border-destructive/40 text-destructive hover:bg-destructive/5 col-span-2 flex items-center justify-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Remover tabela
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

const BorderMenu = ({ editor }: { editor: Editor }) => {
  const [color, setColor] = useState("#000000");
  const [width, setWidth] = useState("1px");
  const [style, setStyle] = useState<"solid" | "dashed" | "dotted" | "none">("solid");
  const [scope, setScope] = useState<CellScope>("cell");
  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  const borderValue = style === "none" ? "0px hidden transparent" : `${width} ${style} ${color}`;

  const applyBorders = (sides: Array<"top" | "right" | "bottom" | "left">) => {
    const patch: Record<string, string> = {};
    sides.forEach((s) => {
      patch[`border-${s}`] = borderValue;
    });
    applyStyleToScope(editor, scope, patch);
  };

  const applyToTable = (sides: Array<"top" | "right" | "bottom" | "left"> | "all") => {
    const patch: Record<string, string> = {};
    const list = sides === "all" ? (["top", "right", "bottom", "left"] as const) : sides;
    list.forEach((s) => {
      patch[`border-${s}`] = borderValue;
    });
    const current = editor.getAttributes("table").style as string | null | undefined;
    const merged = mergeStyleString(current, patch);
    editor.chain().focus().updateAttributes("table", { style: merged || null }).run();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          disabled={!inCell}
          title={inCell ? "Bordas da célula" : "Selecione uma célula primeiro"}
          className="h-8 px-1.5 rounded-md text-foreground hover:bg-muted disabled:opacity-40 flex items-center gap-1"
        >
          <span className="text-[11px] font-medium">Bordas</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-3" align="start">
        <div className="space-y-2">
          <label className="block text-[10px] font-bold uppercase text-muted-foreground">Aplicar em</label>
          <div className="grid grid-cols-4 gap-1">
            {([
              { v: "cell", l: "Célula" },
              { v: "row", l: "Linha" },
              { v: "column", l: "Coluna" },
              { v: "table", l: "Tabela" },
            ] as Array<{ v: CellScope; l: string }>).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setScope(opt.v)}
                className={`h-6 rounded text-[10px] font-medium transition-colors ${
                  scope === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <label className="block text-[10px] font-bold uppercase text-muted-foreground">Cor</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-full rounded border border-border bg-background"
          />
          <label className="block text-[10px] font-bold uppercase text-muted-foreground">Espessura</label>
          <select
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            className="w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
          >
            <option value="0.5px">0.5px</option>
            <option value="1px">1px</option>
            <option value="2px">2px</option>
            <option value="3px">3px</option>
          </select>
          <label className="block text-[10px] font-bold uppercase text-muted-foreground">Estilo</label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as any)}
            className="w-full h-7 px-2 rounded border border-border bg-background text-[12px]"
          >
            <option value="solid">Sólida</option>
            <option value="dashed">Tracejada</option>
            <option value="dotted">Pontilhada</option>
            <option value="none">Nenhuma</option>
          </select>
          <p className="text-[10px] font-bold uppercase text-muted-foreground pt-1">Lados</p>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => applyBorders(["top", "right", "bottom", "left"])}
              className="h-7 rounded border border-border hover:bg-muted col-span-2"
            >
              Todas as bordas
            </button>
            <button type="button" onClick={() => applyBorders(["top"])} className="h-7 rounded border border-border hover:bg-muted">Topo</button>
            <button type="button" onClick={() => applyBorders(["bottom"])} className="h-7 rounded border border-border hover:bg-muted">Inferior</button>
            <button type="button" onClick={() => applyBorders(["left"])} className="h-7 rounded border border-border hover:bg-muted">Esquerda</button>
            <button type="button" onClick={() => applyBorders(["right"])} className="h-7 rounded border border-border hover:bg-muted">Direita</button>
          </div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground pt-1">Borda externa da tabela</p>
          <button
            type="button"
            onClick={() => applyToTable("all")}
            className="h-7 w-full rounded border border-border hover:bg-muted text-[11px]"
          >
            Aplicar contorno externo
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ─── Componente principal ───────────────────────────────────────────────────
interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Lista customizada de variáveis disponíveis no botão "Variável".
   *  Quando omitida, usa PLACEHOLDERS (mapas de trabalho). */
  placeholders?: PlaceholderDef[];
  /** Slot extra renderizado dentro da barra de ferramentas, à direita
   *  do botão "Variável" (antes do "Código-fonte"). */
  toolbarExtras?: React.ReactNode;
  /** Fonte padrão exibida na área de edição/preview e refletida no seletor
   *  de fontes da barra de ferramentas. Use quando o editor deve refletir
   *  exatamente a fonte usada na impressão (ex.: laudos científicos =
   *  Courier New). Quando omitido, usa Inter. */
  defaultFontFamily?: { label: string; value: string };
}

// ─── Helper: aplica patch ao atributo `style` de um nó ProseMirror ──────────
function patchNodeStyle(
  editor: Editor,
  nodeName: "tableCell" | "tableHeader" | "tableRow" | "table",
  patch: Record<string, string>,
) {
  const current = editor.getAttributes(nodeName).style as string | null | undefined;
  const merged = mergeStyleString(current, patch);
  editor.chain().focus().updateAttributes(nodeName, { style: merged || null }).run();
}

// ─── Helpers de escopo: aplica patch a células/linha/coluna/tabela ──────────
export type CellScope = "cell" | "row" | "column" | "table";

/**
 * Coleta as posições (`pos`) das células-alvo conforme o escopo desejado.
 * - "cell": célula(s) atualmente selecionadas (CellSelection) ou a célula do cursor.
 * - "row":  todas as células da(s) linha(s) que contém(êm) o cursor / seleção.
 * - "column": todas as células da(s) coluna(s) que contém(êm) o cursor / seleção.
 * - "table": todas as células da tabela atual.
 */
function getTargetCellPositions(editor: Editor, scope: CellScope): number[] {
  const { state } = editor;
  const sel = state.selection as any;

  // Localiza a tabela ancestral e seu pos
  let tableNode: PMNode | null = null;
  let tablePos = -1;
  const $from = sel.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === "table") {
      tableNode = n;
      tablePos = $from.before(d);
      break;
    }
  }
  if (!tableNode || tablePos < 0) return [];

  const map = TableMap.get(tableNode);
  const tableStart = tablePos + 1; // posição interna do conteúdo da tabela

  // Para "table": todas as células
  if (scope === "table") {
    const seen = new Set<number>();
    map.map.forEach((cellPos) => {
      seen.add(tableStart + cellPos);
    });
    return Array.from(seen);
  }

  // Determina o conjunto de células base (seleção ou cursor)
  let baseRects: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  if (sel instanceof CellSelection) {
    const rect = map.rectBetween(
      sel.$anchorCell.pos - tableStart,
      sel.$headCell.pos - tableStart,
    );
    baseRects.push(rect);
  } else {
    // Cursor dentro de uma célula
    let cellPos = -1;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type.name === "tableCell" || n.type.name === "tableHeader") {
        cellPos = $from.before(d);
        break;
      }
    }
    if (cellPos < 0) return [];
    const relative = cellPos - tableStart;
    const rect = map.findCell(relative);
    baseRects.push(rect);
  }

  if (scope === "cell") {
    const seen = new Set<number>();
    baseRects.forEach((r) => {
      for (let row = r.top; row < r.bottom; row++) {
        for (let col = r.left; col < r.right; col++) {
          seen.add(tableStart + map.map[row * map.width + col]);
        }
      }
    });
    return Array.from(seen);
  }

  if (scope === "row") {
    const seen = new Set<number>();
    baseRects.forEach((r) => {
      for (let row = r.top; row < r.bottom; row++) {
        for (let col = 0; col < map.width; col++) {
          seen.add(tableStart + map.map[row * map.width + col]);
        }
      }
    });
    return Array.from(seen);
  }

  // scope === "column"
  const seen = new Set<number>();
  baseRects.forEach((r) => {
    for (let col = r.left; col < r.right; col++) {
      for (let row = 0; row < map.height; row++) {
        seen.add(tableStart + map.map[row * map.width + col]);
      }
    }
  });
  return Array.from(seen);
}

function getCurrentCellStyleMap(editor: Editor): Map<string, string> {
  const { state } = editor;
  const cell = findCellAt(state, state.selection.from);
  if (!cell) return new Map();
  return styleStringToMap((cell.cellNode.attrs?.style as string | null | undefined) ?? null);
}

function selectCellFromDomTarget(editor: Editor, target: HTMLElement): boolean {
  const cellEl = target.closest("td, th") as HTMLElement | null;
  if (!cellEl || !editor.view.dom.contains(cellEl)) return false;
  try {
    const pos = editor.view.posAtDOM(cellEl, 0);
    editor.commands.setTextSelection(Math.min(pos + 1, editor.state.doc.content.size));
    editor.view.focus();
    return true;
  } catch {
    return false;
  }
}

/** Aplica um patch de CSS ao atributo `style` de cada célula-alvo. */
export function applyStyleToScope(
  editor: Editor,
  scope: CellScope,
  patch: Record<string, string>,
) {
  const positions = getTargetCellPositions(editor, scope);
  if (positions.length === 0) return;
  const { tr } = editor.state;
  positions.forEach((pos) => {
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    const current = (node.attrs?.style as string | null | undefined) ?? null;
    const merged = mergeStyleString(current, patch);
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      style: merged || null,
    });
  });
  editor.view.dispatch(tr);
  editor.view.focus();
}

/** Aplica patch ao(s) `tableRow` da seleção/escopo. */
function applyStyleToRows(editor: Editor, patch: Record<string, string>) {
  const { state } = editor;
  const sel = state.selection as any;
  const $from = sel.$from;

  // Localiza tabela
  let tableNode: PMNode | null = null;
  let tablePos = -1;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === "table") {
      tableNode = n;
      tablePos = $from.before(d);
      break;
    }
  }
  if (!tableNode || tablePos < 0) return;

  const map = TableMap.get(tableNode);
  const tableStart = tablePos + 1;

  let topRow = 0;
  let bottomRow = map.height;
  if (sel instanceof CellSelection) {
    const rect = map.rectBetween(
      sel.$anchorCell.pos - tableStart,
      sel.$headCell.pos - tableStart,
    );
    topRow = rect.top;
    bottomRow = rect.bottom;
  } else {
    let cellPos = -1;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type.name === "tableCell" || n.type.name === "tableHeader") {
        cellPos = $from.before(d);
        break;
      }
    }
    if (cellPos < 0) return;
    const rect = map.findCell(cellPos - tableStart);
    topRow = rect.top;
    bottomRow = rect.bottom;
  }

  // Posição absoluta de cada linha: navegar pelo nó table
  const tr = state.tr;
  let rowIndex = 0;
  tableNode.forEach((rowNode, rowOffset) => {
    if (rowIndex >= topRow && rowIndex < bottomRow) {
      const rowPos = tableStart + rowOffset;
      const current = (rowNode.attrs?.style as string | null | undefined) ?? null;
      const merged = mergeStyleString(current, patch);
      tr.setNodeMarkup(rowPos, undefined, {
        ...rowNode.attrs,
        style: merged || null,
      });
    }
    rowIndex++;
  });
  editor.view.dispatch(tr);
  editor.view.focus();
}

export function applyColumnWidth(editor: Editor, widthPercent: string) {
  const { state } = editor;
  const sel = state.selection as any;
  const $from = sel.$from;

  let tableNode: PMNode | null = null;
  let tablePos = -1;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === "table") {
      tableNode = n;
      tablePos = $from.before(d);
      break;
    }
  }
  if (!tableNode || tablePos < 0) return;

  const map = TableMap.get(tableNode);
  const tableStart = tablePos + 1;

  let baseRects: Array<{ left: number; right: number; top: number; bottom: number }> = [];
  if (sel instanceof CellSelection) {
    baseRects.push(
      map.rectBetween(sel.$anchorCell.pos - tableStart, sel.$headCell.pos - tableStart),
    );
  } else {
    let cellPos = -1;
    for (let d = $from.depth; d > 0; d--) {
      const n = $from.node(d);
      if (n.type.name === "tableCell" || n.type.name === "tableHeader") {
        cellPos = $from.before(d);
        break;
      }
    }
    if (cellPos < 0) return;
    baseRects.push(map.findCell(cellPos - tableStart));
  }

  const targetColumns = new Set<number>();
  baseRects.forEach((r) => {
    for (let col = r.left; col < r.right; col++) targetColumns.add(col);
  });
  if (targetColumns.size === 0) return;

  const resolveAnchorCellPos = (col: number) => {
    const seen = new Set<number>();
    for (let row = 0; row < map.height; row++) {
      const relativePos = map.map[row * map.width + col];
      if (seen.has(relativePos)) continue;
      seen.add(relativePos);

      const cellRect = map.findCell(relativePos);
      if (cellRect.left === col) {
        return tableStart + relativePos;
      }
    }
    return null;
  };

  const tr = state.tr;
  targetColumns.forEach((col) => {
    const anchorPos = resolveAnchorCellPos(col);
    if (anchorPos == null) return;
    const node = state.doc.nodeAt(anchorPos);
    if (!node) return;
    const current = (node.attrs?.style as string | null | undefined) ?? null;
    const merged = mergeStyleString(current, { width: widthPercent ? `${widthPercent}%` : "" });
    tr.setNodeMarkup(anchorPos, undefined, {
      ...node.attrs,
      style: merged || null,
    });
  });

  editor.view.dispatch(tr);
  editor.view.focus();
}

// ─── Menu: formatar célula / linha / tabela ──────────────────────────────────
const CellFormatMenu = ({ editor }: { editor: Editor }) => {
  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  const [bg, setBg] = useState("#FFFFFF");
  const [vAlign, setVAlign] = useState<"top" | "middle" | "bottom">("middle");
  const [padding, setPadding] = useState("4");
  const [colWidth, setColWidth] = useState("");
  const [rowHeight, setRowHeight] = useState("");
  const [tableWidth, setTableWidth] = useState("100");
  const [scope, setScope] = useState<CellScope>("cell");

  const onApplyCell = () => {
    if (!inCell) return;
    applyStyleToScope(editor, scope, {
      "background-color": bg,
      "vertical-align": vAlign,
      padding: `${padding}px`,
    });
  };

  const onClearCell = () => {
    if (!inCell) return;
    applyStyleToScope(editor, scope, {
      "background-color": "",
      "vertical-align": "",
      padding: "",
    });
  };

  const onApplyColumnWidth = () => {
    if (!inCell) return;
    applyColumnWidth(editor, colWidth);
  };

  const onApplyRowHeight = () => {
    if (!inCell) return;
    // Altura aplicada apenas à(s) linha(s) selecionada(s)
    applyStyleToRows(editor, { height: rowHeight ? `${rowHeight}px` : "" });
  };

  const onApplyTableWidth = () => {
    if (!editor.isActive("table")) return;
    patchNodeStyle(editor, "table", {
      width: `${tableWidth}%`,
      "table-layout": "fixed",
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          disabled={!inCell}
          title={inCell ? "Formatar célula / linha / tabela" : "Selecione uma célula primeiro"}
          className="h-8 px-1.5 rounded-md text-foreground hover:bg-muted disabled:opacity-40 flex items-center gap-1"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-[11px] font-medium">Formatar</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3 space-y-3" align="start">
        {/* Escopo + Estilo de célula */}
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Aplicar em</p>
          <div className="grid grid-cols-4 gap-1 mb-3">
            {([
              { v: "cell", l: "Célula" },
              { v: "row", l: "Linha" },
              { v: "column", l: "Coluna" },
              { v: "table", l: "Tabela" },
            ] as Array<{ v: CellScope; l: string }>).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setScope(opt.v)}
                className={`h-6 rounded text-[10px] font-medium transition-colors ${
                  scope === opt.v
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Estilo</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-foreground w-16">Fundo</label>
              <input
                type="color"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="h-7 w-10 rounded border border-border bg-background"
              />
              <input
                type="text"
                value={bg}
                onChange={(e) => setBg(e.target.value)}
                className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-foreground w-16">V-Align</label>
              <select
                value={vAlign}
                onChange={(e) => setVAlign(e.target.value as any)}
                className="flex-1 h-7 px-2 rounded border border-border bg-background text-[12px]"
              >
                <option value="top">Topo</option>
                <option value="middle">Meio</option>
                <option value="bottom">Base</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-foreground w-16">Padding</label>
              <input
                type="number"
                min={0}
                max={40}
                value={padding}
                onChange={(e) => setPadding(e.target.value)}
                className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
              />
              <span className="text-[10px] text-muted-foreground">px</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                type="button"
                onClick={onApplyCell}
                className="h-7 rounded bg-primary text-primary-foreground text-[11px] font-semibold"
              >
                Aplicar
              </button>
              <button
                type="button"
                onClick={onClearCell}
                className="h-7 rounded border border-border text-[11px] hover:bg-muted"
              >
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Coluna */}
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
            Largura coluna atual
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={5}
              max={100}
              placeholder="auto"
              value={colWidth}
              onChange={(e) => setColWidth(e.target.value)}
              className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
            <button
              type="button"
              onClick={onApplyColumnWidth}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[11px] font-semibold"
            >
              OK
            </button>
          </div>
        </div>

        {/* Linha */}
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
            Altura linha atual
          </p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={10}
              max={400}
              placeholder="auto"
              value={rowHeight}
              onChange={(e) => setRowHeight(e.target.value)}
              className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">px</span>
            <button
              type="button"
              onClick={onApplyRowHeight}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[11px] font-semibold"
            >
              OK
            </button>
          </div>
        </div>

        {/* Tabela */}
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Largura tabela</p>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={20}
              max={100}
              value={tableWidth}
              onChange={(e) => setTableWidth(e.target.value)}
              className="flex-1 h-7 px-2 text-[11px] rounded border border-border bg-background"
            />
            <span className="text-[10px] text-muted-foreground">%</span>
            <button
              type="button"
              onClick={onApplyTableWidth}
              className="h-7 px-3 rounded bg-primary text-primary-foreground text-[11px] font-semibold"
            >
              OK
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ─── Diálogo: editar código-fonte HTML ──────────────────────────────────────
const SourceCodeDialog = ({
  open,
  initialHtml,
  onClose,
  onApply,
}: {
  open: boolean;
  initialHtml: string;
  onClose: () => void;
  onApply: (html: string) => void;
}) => {
  const [draft, setDraft] = useState(initialHtml);

  useEffect(() => {
    if (open) setDraft(initialHtml);
  }, [open, initialHtml]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            Código-fonte HTML
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            O HTML será sanitizado e normalizado para o motor de impressão A4
            antes de ser aplicado. Tags fora da whitelist serão removidas.
          </p>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="w-full h-[420px] p-3 rounded-md border border-border bg-muted/30 font-mono text-[12px] leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-border text-[12px] font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold"
          >
            Aplicar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Diálogo: propriedades de célula (CKEditor-like) ────────────────────────
type CellPropsScope = CellScope;

const CellPropertiesDialog = ({
  open,
  editor,
  onClose,
}: {
  open: boolean;
  editor: Editor | null;
  onClose: () => void;
}) => {
  const [scope, setScope] = useState<CellPropsScope>("cell");
  const [bg, setBg] = useState("#FFFFFF");
  const [hAlign, setHAlign] = useState<"left" | "center" | "right">("left");
  const [vAlign, setVAlign] = useState<"top" | "middle" | "bottom">("middle");
  const [padding, setPadding] = useState("4");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [borderColor, setBorderColor] = useState("#000000");
  const [borderWidth, setBorderWidth] = useState("1");
  const [borderStyle, setBorderStyle] = useState<"solid" | "dashed" | "dotted" | "none">("solid");
  const [borderSides, setBorderSides] = useState({ top: false, right: false, bottom: false, left: false });
  const [bgEnabled, setBgEnabled] = useState(false);

  // Pré-preenche valores ao abrir, lendo a célula atual
  useEffect(() => {
    if (!open || !editor) return;
    const styleMap = getCurrentCellStyleMap(editor);
    const rawBg = styleMap.get("background-color");
    setBg(cssColorToHex(rawBg, "#FFFFFF"));
    setBgEnabled(!!rawBg && rawBg !== "transparent");
    setHAlign((styleMap.get("text-align") as "left" | "center" | "right") || "left");
    setVAlign((styleMap.get("vertical-align") as "top" | "middle" | "bottom") || "middle");
    const padRaw = (styleMap.get("padding") || "").trim();
    const padMatch = padRaw.match(/(-?\d+(?:\.\d+)?)/);
    setPadding(padMatch ? padMatch[1] : "4");
    setWidth((styleMap.get("width") || "").replace("%", "").replace("px", ""));
    setHeight((styleMap.get("height") || "").replace("px", ""));

    // Rehidrata bordas a partir de border-{top,right,bottom,left}
    const sides = { top: false, right: false, bottom: false, left: false } as Record<
      "top" | "right" | "bottom" | "left",
      boolean
    >;
    let detectedColor: string | null = null;
    let detectedWidth: string | null = null;
    let detectedStyle: "solid" | "dashed" | "dotted" | "none" | null = null;
    (["top", "right", "bottom", "left"] as const).forEach((s) => {
      const v = (styleMap.get(`border-${s}`) || "").trim();
      if (!v) return;
      // Formato esperado: "<width> <style> <color>"
      const parts = v.split(/\s+/);
      const w = parts[0] || "";
      const st = (parts[1] || "") as "solid" | "dashed" | "dotted" | "none" | "hidden";
      const c = parts.slice(2).join(" ") || "";
      const isInvisible = st === "hidden" || w === "0px" || w === "0";
      sides[s] = true;
      if (!detectedStyle) detectedStyle = isInvisible ? "none" : (st as any);
      if (!detectedWidth && !isInvisible) detectedWidth = w.replace("px", "");
      if (!detectedColor && !isInvisible) detectedColor = cssColorToHex(c, "#000000");
    });
    setBorderSides(sides);
    if (detectedColor) setBorderColor(detectedColor);
    if (detectedWidth) setBorderWidth(detectedWidth);
    if (detectedStyle) setBorderStyle(detectedStyle);
  }, [open, editor]);

  if (!editor) return null;

  const apply = () => {
    // Estilo de célula/scope (sem width/height — eles têm fluxo próprio)
    const stylePatch: Record<string, string> = {
      "background-color": bgEnabled ? bg : "",
      "text-align": hAlign,
      "vertical-align": vAlign,
      padding: `${padding}px`,
    };

    // Bordas: aplica em TODOS os 4 lados — checked recebe o valor configurado,
    // unchecked é explicitamente limpo (string vazia remove a declaração).
    const borderValue =
      borderStyle === "none"
        ? "0px hidden transparent"
        : `${borderWidth}px ${borderStyle} ${borderColor}`;
    (["top", "right", "bottom", "left"] as const).forEach((s) => {
      stylePatch[`border-${s}`] = borderSides[s] ? borderValue : "";
    });

    applyStyleToScope(editor, scope, stylePatch);

    // Largura: precisa ir na célula-âncora da primeira linha da coluna
    // (com `table-layout: fixed`, só essa largura tem efeito visual).
    // Aplica sempre que o usuário preencheu/limpou o campo, independente do escopo.
    applyColumnWidth(editor, width);

    // Altura: vai no nó `tableRow` para que afete a linha inteira; o motor
    // de impressão depois propaga essa altura para a primeira <td> da linha.
    applyStyleToRows(editor, { height: height ? `${height}px` : "" });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Propriedades da célula
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Escopo */}
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Aplicar em</p>
            <div className="grid grid-cols-4 gap-1">
              {([
                { v: "cell", l: "Célula" },
                { v: "row", l: "Linha" },
                { v: "column", l: "Coluna" },
                { v: "table", l: "Tabela" },
              ] as Array<{ v: CellPropsScope; l: string }>).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setScope(opt.v)}
                  className={`h-7 rounded text-[11px] font-medium transition-colors ${
                    scope === opt.v
                      ? "bg-primary text-primary-foreground"
                      : "border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {/* Dimensões */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Largura coluna (%)</p>
              <input
                type="number"
                min={5}
                max={100}
                placeholder="auto"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Altura linha (px)</p>
              <input
                type="number"
                min={10}
                max={400}
                placeholder="auto"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              />
            </div>
          </div>

          {/* Alinhamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Alinhamento horizontal</p>
              <select
                value={hAlign}
                onChange={(e) => setHAlign(e.target.value as "left" | "center" | "right")}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              >
                <option value="left">Esquerda</option>
                <option value="center">Centro</option>
                <option value="right">Direita</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Alinhamento vertical</p>
              <select
                value={vAlign}
                onChange={(e) => setVAlign(e.target.value as "top" | "middle" | "bottom")}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              >
                <option value="top">Topo</option>
                <option value="middle">Meio</option>
                <option value="bottom">Base</option>
              </select>
            </div>
          </div>

          {/* Cor e padding */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Cor de fundo</p>
              <div className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={bgEnabled}
                  onChange={(e) => setBgEnabled(e.target.checked)}
                  className="h-4 w-4"
                  title="Aplicar cor de fundo"
                />
                <input
                  type="color"
                  value={bg}
                  onChange={(e) => { setBg(e.target.value); setBgEnabled(true); }}
                  className="h-8 w-12 rounded border border-border bg-background"
                />
                <input
                  type="text"
                  value={bg}
                  onChange={(e) => { setBg(e.target.value); setBgEnabled(true); }}
                  className="flex-1 h-8 px-2 rounded border border-border bg-background text-[12px]"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Padding (px)</p>
              <input
                type="number"
                min={0}
                max={40}
                value={padding}
                onChange={(e) => setPadding(e.target.value)}
                className="w-full h-8 px-2 rounded border border-border bg-background text-[12px]"
              />
            </div>
          </div>

          {/* Bordas */}
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">Bordas</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Cor</label>
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => setBorderColor(e.target.value)}
                  className="h-8 w-full rounded border border-border bg-background"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Espessura (px)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(e.target.value)}
                  className="h-8 w-full px-2 rounded border border-border bg-background text-[12px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Estilo</label>
                <select
                  value={borderStyle}
                  onChange={(e) => setBorderStyle(e.target.value as "solid" | "dashed" | "dotted" | "none")}
                  className="h-8 w-full px-2 rounded border border-border bg-background text-[12px]"
                >
                  <option value="solid">Sólida</option>
                  <option value="dashed">Tracejada</option>
                  <option value="dotted">Pontilhada</option>
                  <option value="none">Nenhuma</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(["top", "right", "bottom", "left"] as const).map((s) => (
                <label
                  key={s}
                  className={`h-7 rounded border flex items-center justify-center text-[10px] cursor-pointer transition-colors ${
                    borderSides[s]
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={borderSides[s]}
                    onChange={(e) => setBorderSides({ ...borderSides, [s]: e.target.checked })}
                    className="sr-only"
                  />
                  {s === "top" ? "Topo" : s === "right" ? "Direita" : s === "bottom" ? "Inferior" : "Esquerda"}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border border-border text-[12px] font-medium hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={apply}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold"
          >
            Aplicar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ─── Menu contextual de tabela (right-click) ────────────────────────────────
const TableContextMenu = ({
  editor,
  position,
  onClose,
  onOpenProperties,
}: {
  editor: Editor;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onOpenProperties: () => void;
}) => {
  const [openSub, setOpenSub] = useState<null | "cell" | "row" | "col">(null);

  useEffect(() => {
    if (!position) return;
    const handler = () => {
      setOpenSub(null);
      onClose();
    };
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [position, onClose]);

  if (!position) return null;

  const Item = ({
    icon, label, onClick, danger, disabled,
  }: { icon?: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
        setOpenSub(null);
        onClose();
      }}
      className={`w-full h-8 px-3 flex items-center gap-2 text-[12px] rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted disabled:hover:bg-transparent"
      }`}
    >
      <span className="opacity-70 w-4 inline-flex justify-center">{icon}</span>
      {label}
    </button>
  );

  const SubTrigger = ({
    icon, label, sub,
  }: { icon: React.ReactNode; label: string; sub: "cell" | "row" | "col" }) => (
    <button
      type="button"
      onMouseEnter={() => setOpenSub(sub)}
      onClick={(e) => {
        e.stopPropagation();
        setOpenSub((s) => (s === sub ? null : sub));
      }}
      className={`w-full h-8 px-3 flex items-center gap-2 text-[12px] rounded-md transition-colors ${
        openSub === sub ? "bg-muted text-foreground" : "text-foreground hover:bg-muted"
      }`}
    >
      <span className="opacity-70 w-4 inline-flex justify-center">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-60" />
    </button>
  );

  const Divider = () => <div className="my-1 h-px bg-border" />;

  const inCell = editor.isActive("tableCell") || editor.isActive("tableHeader");
  const sel = editor.state.selection as any;
  const isRangeSelection = sel instanceof CellSelection && (sel as CellSelection).$anchorCell?.pos !== (sel as CellSelection).$headCell?.pos;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      style={{ position: "fixed", top: position.y, left: position.x, zIndex: 60 }}
      className="w-[220px] rounded-lg border border-border bg-popover shadow-lg p-1 backdrop-blur-md relative"
    >
      <SubTrigger icon={<TableIcon className="h-3.5 w-3.5" />} label="Célula" sub="cell" />
      <SubTrigger icon={<Rows className="h-3.5 w-3.5" />} label="Linha" sub="row" />
      <SubTrigger icon={<Columns className="h-3.5 w-3.5" />} label="Coluna" sub="col" />
      <Divider />
      <Item
        icon={<Trash2 className="h-3.5 w-3.5" />}
        label="Apagar Tabela"
        onClick={() => editor.chain().focus().deleteTable().run()}
        danger
      />
      <Item
        icon={<Settings2 className="h-3.5 w-3.5" />}
        label="Formatar Tabela"
        onClick={onOpenProperties}
      />

      {/* Submenu Célula */}
      {openSub === "cell" && (
        <div
          onMouseLeave={() => setOpenSub(null)}
          className="absolute left-full top-0 ml-1 w-[260px] rounded-lg border border-border bg-popover shadow-lg p-1 backdrop-blur-md"
        >
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir célula a esquerda"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir célula a direita"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Minus className="h-3.5 w-3.5" />}
            label="Remover Células"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            danger
            disabled={!inCell}
          />
          <Divider />
          <Item
            icon={<Combine className="h-3.5 w-3.5" />}
            label="Mesclar Células"
            onClick={() => editor.chain().focus().mergeCells().run()}
            disabled={!isRangeSelection}
          />
          <Item
            icon={<Combine className="h-3.5 w-3.5" />}
            label="Mesclar com célula a direita"
            onClick={() => mergeCellDirection(editor, "right")}
            disabled={!inCell}
          />
          <Item
            icon={<Combine className="h-3.5 w-3.5" />}
            label="Mesclar com célula abaixo"
            onClick={() => mergeCellDirection(editor, "down")}
            disabled={!inCell}
          />
          <Divider />
          <Item
            icon={<SplitSquareHorizontal className="h-3.5 w-3.5" />}
            label="Dividir célula horizontalmente"
            onClick={() => splitCellDirection(editor, "vertical")}
            disabled={!inCell}
          />
          <Item
            icon={<SplitSquareVertical className="h-3.5 w-3.5" />}
            label="Dividir célula verticalmente"
            onClick={() => splitCellDirection(editor, "horizontal")}
            disabled={!inCell}
          />
          <Divider />
          <Item
            icon={<Settings2 className="h-3.5 w-3.5" />}
            label="Propriedades da célula"
            onClick={onOpenProperties}
            disabled={!inCell}
          />
          <Item
            icon={<Eraser className="h-3.5 w-3.5" />}
            label="Limpar formatação"
            onClick={() => applyStyleToScope(editor, "cell", {
              "background-color": "", padding: "", "vertical-align": "",
              width: "", height: "",
              "border-top": "", "border-right": "", "border-bottom": "", "border-left": "",
            })}
            disabled={!inCell}
          />
        </div>
      )}

      {/* Submenu Linha */}
      {openSub === "row" && (
        <div
          onMouseLeave={() => setOpenSub(null)}
          className="absolute left-full top-0 ml-1 w-[220px] rounded-lg border border-border bg-popover shadow-lg p-1 backdrop-blur-md"
        >
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir linha acima"
            onClick={() => editor.chain().focus().addRowBefore().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir linha abaixo"
            onClick={() => editor.chain().focus().addRowAfter().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Minus className="h-3.5 w-3.5" />}
            label="Excluir linha"
            onClick={() => editor.chain().focus().deleteRow().run()}
            danger
            disabled={!inCell}
          />
        </div>
      )}

      {/* Submenu Coluna */}
      {openSub === "col" && (
        <div
          onMouseLeave={() => setOpenSub(null)}
          className="absolute left-full top-0 ml-1 w-[220px] rounded-lg border border-border bg-popover shadow-lg p-1 backdrop-blur-md"
        >
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir coluna à esquerda"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Plus className="h-3.5 w-3.5" />}
            label="Inserir coluna à direita"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            disabled={!inCell}
          />
          <Item
            icon={<Minus className="h-3.5 w-3.5" />}
            label="Excluir coluna"
            onClick={() => editor.chain().focus().deleteColumn().run()}
            danger
            disabled={!inCell}
          />
        </div>
      )}
    </div>
  );
};

const RichTextEditorPro = ({ content, onChange, placeholder, placeholders, toolbarExtras, defaultFontFamily }: Props) => {
  const fontFamilies = defaultFontFamily
    ? [
        { label: `${defaultFontFamily.label} (padrão)`, value: "" },
        ...FONT_FAMILIES.filter((f) => f.value !== "" && f.value !== defaultFontFamily.value),
      ]
    : FONT_FAMILIES;
  const wrapperFontStyle = defaultFontFamily?.value
    ? { fontFamily: defaultFontFamily.value }
    : undefined;
  const lastEmitted = useRef<string>("");
  const [, force] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        paragraph: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: {},
        codeBlock: false,
        horizontalRule: false,
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      FontSize,
      Subscript,
      Superscript,
      ParagraphWithStyle,
      TextAlign.configure({ types: ["paragraph", "tableCell", "tableHeader"] }),
      TableWithStyle.configure({
        resizable: true,
        HTMLAttributes: { style: "width: 100%; table-layout: fixed" },
      }),
      TableRowWithStyle,
      TableHeaderWithStyle,
      TableCellWithStyle,
      DivWithStyle,
      ImageWithSize.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { style: "max-width: 100%; height: auto;" },
      }),
    ],
    content: content || "",
    editorProps: {
      attributes: {
        class:
          "prose-mapa prose-mapa-editor a4-sheet focus:outline-none text-[13px] leading-snug break-words",
      },
    },
    onUpdate: ({ editor }) => {
      const raw = editor.getHTML();
      const clean = normalizeMapaHtml(raw);
      if (clean !== lastEmitted.current) {
        lastEmitted.current = clean;
        onChange(clean);
        // força re-render do toolbar (undo/redo state)
        force((n) => n + 1);
      }
    },
    onSelectionUpdate: () => {
      // re-render toolbar para atualizar estados ativos
      force((n) => n + 1);
    },
  });

  // Sincroniza conteúdo externo (ex.: aplicar template)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (content !== current && content !== lastEmitted.current) {
      editor.commands.setContent(content || "", false);
    }
  }, [content, editor]);

  const placeholderGroups = useMemo(() => {
    const list = placeholders ?? PLACEHOLDERS;
    return Array.from(
      list.reduce((acc, p) => {
        const arr = acc.get(p.group) ?? [];
        arr.push(p);
        acc.set(p.group, arr);
        return acc;
      }, new Map<string, PlaceholderDef[]>()).entries(),
    );
  }, [placeholders]);

  if (!editor) {
    return (
      <div className="border border-border rounded-lg bg-card min-h-[440px] animate-pulse" />
    );
  }

  const insertPlaceholder = (tag: string) => {
    editor.chain().focus().insertContent(`{{${tag}}}`).run();
  };

  const applySource = (raw: string) => {
    const clean = normalizeMapaHtml(raw || "");
    editor.commands.setContent(clean, false);
    lastEmitted.current = clean;
    onChange(clean);
    setSourceOpen(false);
  };

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  const currentColor = editor.getAttributes("textStyle").color as string | undefined;
  const currentBg = editor.getAttributes("highlight").color as string | undefined;
  const currentFontSize = editor.getAttributes("textStyle").fontSize as string | undefined;
  const currentFamily = editor.getAttributes("textStyle").fontFamily as string | undefined;

  // Line-height: aplica no nó mais adequado do contexto (célula > parágrafo).
  // Aplicar apenas no <p> falha dentro de tabelas porque o normalizeMapaHtml
  // converte <p> em <span> nas células, e <span> (TextStyle) não persiste
  // line-height — o estilo é perdido ao re-renderizar/re-parsear.
  const lineHeightTargetType = editor.isActive("tableHeader")
    ? "tableHeader"
    : editor.isActive("tableCell")
    ? "tableCell"
    : "paragraph";
  const currentLineHeight =
    styleStringToMap(
      editor.getAttributes(lineHeightTargetType).style as string | null | undefined,
    ).get("line-height") || "";

  const setLineHeight = (value: string) => {
    const type = lineHeightTargetType;
    const current = editor.getAttributes(type).style as string | null | undefined;
    const merged = mergeStyleString(current, { "line-height": value });
    editor
      .chain()
      .focus()
      .updateAttributes(type, { style: merged || null })
      .run();
  };

  return (
    <div className="border border-border/70 rounded-lg overflow-hidden bg-card flex flex-col min-w-0 w-full shadow-sm">
      {/* Toolbar — agrupada em clusters semânticos (estilo Notion/Word moderno) */}
      <div className="sticky top-0 z-10 border-b border-border/60 bg-card/90 backdrop-blur-md px-2 py-2 flex flex-wrap items-center gap-1.5 min-w-0">
        <ToolbarGroup label="Histórico">
        <ToolbarBtn
          disabled={!canUndo}
          onClick={() => editor.chain().focus().undo().run()}
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          disabled={!canRedo}
          onClick={() => editor.chain().focus().redo().run()}
          title="Refazer (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarGroup label="Tipografia">
        {/* Fonte */}
        <select
          value={currentFamily || ""}
          onChange={(e) =>
            e.target.value
              ? editor.chain().focus().setFontFamily(e.target.value).run()
              : editor.chain().focus().unsetFontFamily().run()
          }
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 px-2 text-[12px] rounded-md border border-transparent hover:bg-background bg-transparent text-foreground focus:border-primary outline-none"
          title="Fonte"
        >
          {fontFamilies.map((f) => (
            <option key={f.label} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Tamanho */}
        <select
          value={currentFontSize || ""}
          onChange={(e) =>
            e.target.value
              ? (editor.chain().focus() as any).setFontSize(e.target.value).run()
              : (editor.chain().focus() as any).unsetFontSize().run()
          }
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 px-2 text-[12px] rounded-md border border-transparent hover:bg-background bg-transparent text-foreground focus:border-primary outline-none w-[72px]"
          title="Tamanho"
        >
          <option value="">Auto</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Altura da linha */}
        <select
          value={currentLineHeight}
          onChange={(e) => setLineHeight(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          className="h-8 px-2 text-[12px] rounded-md border border-transparent hover:bg-background bg-transparent text-foreground focus:border-primary outline-none w-[78px]"
          title="Altura da linha"
        >
          <option value="">Altura</option>
          {LINE_HEIGHTS.map((lh) => (
            <option key={lh} value={lh}>{lh}</option>
          ))}
        </select>
        </ToolbarGroup>

        <ToolbarGroup label="Formatação">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Sublinhado (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("subscript")}
          onClick={() => (editor.chain().focus() as any).toggleSubscript().run()}
          title="Subscrito"
        >
          <SubscriptIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("superscript")}
          onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()}
          title="Sobrescrito"
        >
          <SuperscriptIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Citação"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Código inline"
        >
          <CodeIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarGroup label="Cores">
        <ColorPicker
          icon={
            <span className="relative inline-flex flex-col items-center">
              <Palette className="h-3.5 w-3.5" />
              <span className="h-[3px] w-3.5 rounded-sm" style={{ backgroundColor: currentColor || "#000" }} />
            </span>
          }
          title="Cor do texto"
          current={currentColor}
          onPick={(hex) => editor.chain().focus().setColor(hex).run()}
          onClear={() => editor.chain().focus().unsetColor().run()}
        />
        <ColorPicker
          icon={
            <span className="relative inline-flex flex-col items-center">
              <PaintBucket className="h-3.5 w-3.5" />
              <span className="h-[3px] w-3.5 rounded-sm" style={{ backgroundColor: currentBg || "transparent", outline: currentBg ? "none" : "1px dashed currentColor" }} />
            </span>
          }
          title="Cor de fundo"
          current={currentBg}
          onPick={(hex) => editor.chain().focus().toggleHighlight({ color: hex }).run()}
          onClear={() => editor.chain().focus().unsetHighlight().run()}
        />
        </ToolbarGroup>

        <ToolbarGroup label="Alinhamento">
        <ToolbarBtn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Alinhar à esquerda"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Centralizar"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Alinhar à direita"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>
        </ToolbarGroup>

        <ToolbarGroup label="Inserir">
        <TableMenu editor={editor} />
        <ImageMenu editor={editor} />
        <ImageSizeMenu editor={editor} />
        <CellFormatMenu editor={editor} />
        <BorderMenu editor={editor} />
        </ToolbarGroup>

        <ToolbarGroup label="Variáveis">
        {/* Inserir variável */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="h-8 px-2 rounded-md text-[11px] font-medium text-foreground hover:bg-background flex items-center gap-1"
              title="Inserir variável"
            >
              <Variable className="h-3.5 w-3.5" />
              Variável
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="end">
            <div className="max-h-[400px] overflow-auto p-2">
              {placeholderGroups.map(([group, items]) => (
                <div key={group} className="mb-3 last:mb-0">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 mb-1">
                    {group}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {items.map((p) => (
                      <button
                        key={p.tag}
                        type="button"
                        onClick={() => insertPlaceholder(p.tag)}
                        className="text-[10px] px-2 py-1 rounded bg-muted hover:bg-primary hover:text-primary-foreground transition-colors font-mono"
                        title={p.label}
                      >
                        {p.tag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        </ToolbarGroup>

        {toolbarExtras}

        {/* Código-fonte (push to right) */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSourceOpen(true)}
            title="Editar código-fonte HTML"
            className="h-8 px-2.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 border border-border/60 flex items-center gap-1.5 transition-colors"
          >
            <Code2 className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Código-fonte</span>
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div
        className="a4-stage relative min-w-0"
        style={wrapperFontStyle}
        onContextMenu={(e) => {
          // Só ativa o menu contextual se o clique foi dentro de uma tabela
          const target = e.target as HTMLElement;
          if (target.closest("table")) {
            e.preventDefault();
            selectCellFromDomTarget(editor, target);
            setCtxMenu({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        <EditorContent editor={editor} />
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, placement: "top" }}
          shouldShow={({ editor }) => editor.isActive("image")}
          className="z-50"
        >
          <div className="flex items-center gap-1 rounded-md border border-border bg-popover shadow-md p-1">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground px-1.5">
              Imagem
            </span>
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() =>
                  editor.chain().focus().updateAttributes("image", { width: `${p}%`, height: null }).run()
                }
                className="h-7 px-2 rounded text-[11px] hover:bg-muted text-foreground"
                title={`Largura ${p}%`}
              >
                {p}%
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor.chain().focus().updateAttributes("image", { width: null, height: null }).run()
              }
              className="h-7 px-2 rounded text-[11px] hover:bg-muted text-foreground"
              title="Tamanho original"
            >
              Auto
            </button>
            <span className="w-px h-5 bg-border mx-0.5" />
            <ImageSizeMenu editor={editor} />
          </div>
        </BubbleMenu>
        {!editor.getText().trim() && editor.getHTML() === "<p></p>" && placeholder && (
          <div className="pointer-events-none absolute top-0 left-0 p-6 text-muted-foreground/50 text-[13px] leading-snug break-words max-w-full">
            {placeholder}
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-muted/20 border-t border-border px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Editor profissional — HTML controlado para impressão A4</span>
        <span>{editor.storage.characterCount?.characters?.() ?? editor.getText().length} caracteres</span>
      </div>

      <SourceCodeDialog
        open={sourceOpen}
        initialHtml={editor.getHTML()}
        onClose={() => setSourceOpen(false)}
        onApply={applySource}
      />

      <CellPropertiesDialog
        open={propsOpen}
        editor={editor}
        onClose={() => setPropsOpen(false)}
      />

      <TableContextMenu
        editor={editor}
        position={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onOpenProperties={() => setPropsOpen(true)}
      />
    </div>
  );
};

export default RichTextEditorPro;