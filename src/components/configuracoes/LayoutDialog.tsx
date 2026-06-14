import { useState, useEffect, useMemo } from "react";
import { FlaskConical, Save, Sparkles, Eye, Code2, Star, Scaling, ChevronDown } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import EditorPlaceholder from "@/components/configuracoes/editor/EditorPlaceholder";
import { useToast } from "@/hooks/use-toast";
import { ExameLayout, addLayout, updateLayout, getLayouts } from "@/data/exameLayoutsStore";
import { getParametros, loadParametros, ExameParametro } from "@/data/exameParametrosStore";
import { buildLayoutTemplate } from "@/lib/laudoTemplate";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { PlaceholderDef } from "@/lib/mapaPlaceholders";

// Placeholders específicos do editor de laudo (independente dos mapas de trabalho).
const LAUDO_PLACEHOLDERS: PlaceholderDef[] = [
  { tag: "paciente.nome", label: "Nome do paciente", group: "Paciente" },
  { tag: "paciente.idade", label: "Idade (anos, meses e dias)", group: "Paciente" },
  { tag: "paciente.sexo", label: "Sexo", group: "Paciente" },
  { tag: "paciente.nascimento", label: "Data de nascimento", group: "Paciente" },
  { tag: "paciente.cpf", label: "CPF", group: "Paciente" },
  { tag: "paciente.protocolo", label: "Protocolo", group: "Paciente" },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface LayoutDialogProps {
  open: boolean;
  onClose: () => void;
  exame: { id: string; nome: string; mnemonico: string; categoria: string } | null;
  editData?: ExameLayout | null;
  defaultMaximized?: boolean;
}

const PREVIEW_DEMO: Record<string, string> = {
  PACIENTE_NOME: "JOÃO DA SILVA (DEMO)",
  PACIENTE_IDADE: "42 anos",
  PACIENTE_SEXO: "Masculino",
  DATA_COLETA: "18/04/2026 08:30",
  DATA_LIBERACAO: "18/04/2026 14:20",
  PROTOCOLO: "2026-0001",
  SOLICITANTE: "Dra. Ana Costa",
};

const LayoutDialog = ({ open, onClose, exame, editData, defaultMaximized = true }: LayoutDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [nomeLayout, setNomeLayout] = useState("");
  const [padrao, setPadrao] = useState(false);
  const [editorContent, setEditorContent] = useState("<p></p>");
  const [saving, setSaving] = useState(false);
  const [parametros, setParametros] = useState<ExameParametro[]>([]);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [margins, setMargins] = useState<{ top: string; right: string; bottom: string; left: string }>({
    top: "10", right: "10", bottom: "10", left: "10",
  });

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setNomeLayout(editData.nome);
      setPadrao(!!editData.padrao);
      setEditorContent(editData.conteudo || "<p></p>");
      const m = (editData.config?.margins ?? {}) as Partial<{ top: number; right: number; bottom: number; left: number }>;
      setMargins({
        top: String(m.top ?? 10),
        right: String(m.right ?? 10),
        bottom: String(m.bottom ?? 10),
        left: String(m.left ?? 5),
      });
    } else {
      setNomeLayout("");
      const existentes = exame?.id ? getLayouts(exame.id) : [];
      setPadrao(existentes.length === 0);
      setEditorContent("<p></p>");
      setMargins({ top: "5", right: "5", bottom: "5", left: "5" });
    }
    setTab("editor");
    if (exame?.id) {
      loadParametros(exame.id).then(() => setParametros(getParametros(exame.id)));
    }
  }, [open, editData, exame?.id]);

  const previewHtml = useMemo(() => {
    let html = editorContent;
    Object.entries(PREVIEW_DEMO).forEach(([k, v]) => {
      html = html.replace(new RegExp(`##${escapeRegex(k)}##`, "g"), v);
    });
    parametros.forEach((p) => {
      const valor = p.tipo === "Número" ? "0,00" : p.opcoesSelect?.[0] ?? "—";
      html = html.replace(
        new RegExp(`##${escapeRegex(p.chave)}##`, "g"),
        `<span style="color:#94a3b8;font-style:italic;">${valor}</span>`,
      );
    });
    return html;
  }, [editorContent, parametros]);

  const handleInserirTemplate = () => {
    if (!exame) return;
    const template = buildLayoutTemplate({ exameNome: exame.nome, parametros });
    setEditorContent(template);
    toast({
      title: "Template padrão inserido",
      description: parametros.length
        ? `${parametros.length} parâmetro(s) mapeado(s) na tabela.`
        : "Cadastre parâmetros para popular a tabela automaticamente.",
    });
  };

  const handleSave = async () => {
    if (!exame?.id) return;
    if (!nomeLayout.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome do layout.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const sanitize = (v: string, fb: number) => {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? Math.min(50, Math.round(n * 10) / 10) : fb;
    };
    const marginsConfig = {
      top: sanitize(margins.top, 5),
      right: sanitize(margins.right, 5),
      bottom: sanitize(margins.bottom, 5),
      left: sanitize(margins.left, 5),
    };
    const payload = {
      nome: nomeLayout.trim(),
      conteudo: editorContent,
      padrao,
      criadoPor: user?.nome || user?.email || "USUARIO",
      config: { ...(editData?.config ?? {}), margins: marginsConfig },
    };
    let ok = false;
    if (editData) ok = await updateLayout(editData.id, exame.id, payload);
    else { const novo = await addLayout(exame.id, payload); ok = !!novo; }
    setSaving(false);
    if (ok) {
      toast({ title: editData ? "Layout atualizado" : "Layout criado" });
      onClose();
    } else {
      toast({ title: "Erro ao salvar", description: "Verifique sua permissão (gestão de exames).", variant: "destructive" });
    }
  };

  const inputClass = "w-full px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200";
  const labelClass = "text-[11px] font-medium text-muted-foreground mb-1.5 block";

  const headerActions = !editData ? (
    <button
      onClick={handleInserirTemplate}
      className="h-9 px-3 rounded-xl border border-primary/40 bg-primary/5 text-[12px] font-medium text-primary hover:bg-primary/10 transition-all duration-200 flex items-center gap-1.5"
      title="Insere um template institucional padronizado com cabeçalho, dados do paciente e tabela de resultados"
    >
      <Sparkles className="h-3.5 w-3.5" /> Template padrão
    </button>
  ) : null;

  const footer = (
    <>
      <button onClick={onClose} className="h-10 px-5 rounded-xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200">
        Cancelar
      </button>
      <button onClick={handleSave} disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all duration-200">
        <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar layout"}
      </button>
    </>
  );

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<FlaskConical className="h-5 w-5 text-primary" />}
      title={editData ? "Editar layout científico" : "Novo layout científico"}
      subtitle={exame?.nome ? `${exame.nome} — motor científico do laudo (metodologia, unidade, VR, cálculo, renderização)` : "Motor científico do laudo (metodologia, unidade, VR, cálculo, renderização)"}
      headerActions={headerActions}
      footer={footer}
      maxWidth="5xl"
      allowMaximize
      defaultMaximized={defaultMaximized}
    >
      <div className="px-6 py-5 space-y-4">
        {/* Identification */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
          <div>
            <label className={labelClass}>Nome do layout *</label>
            <input
              type="text"
              value={nomeLayout}
              onChange={(e) => setNomeLayout(e.target.value)}
              className={inputClass}
              placeholder="Ex: Padrão Hemograma"
              autoFocus
            />
          </div>
          <button
            type="button"
            onClick={() => setPadrao(!padrao)}
            className={`h-[42px] px-4 rounded-xl border text-[12px] font-medium flex items-center gap-2 transition-all duration-200 ${
              padrao
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
            title={padrao ? "Este será o layout padrão de impressão" : "Definir como layout padrão"}
          >
            <Star className={`h-4 w-4 ${padrao ? "fill-primary" : ""}`} />
            {padrao ? "Layout padrão" : "Definir como padrão"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border/50">
          <button
            onClick={() => setTab("editor")}
            className={`h-9 px-4 text-[12px] font-medium flex items-center gap-1.5 border-b-2 transition-all ${tab === "editor" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Code2 className="h-3.5 w-3.5" /> Editor
          </button>
          <button
            onClick={() => setTab("preview")}
            className={`h-9 px-4 text-[12px] font-medium flex items-center gap-1.5 border-b-2 transition-all ${tab === "preview" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <Eye className="h-3.5 w-3.5" /> Pré-visualização
          </button>
        </div>

        {tab === "editor" ? (
          <EditorPlaceholder
            content={editorContent}
            onChange={setEditorContent}
            placeholder="Escreva o conteúdo do laudo, insira tabelas e use os placeholders…"
            defaultFontFamily={{ label: "Courier New", value: '"Courier New", Courier, monospace' }}
            placeholders={LAUDO_PLACEHOLDERS}
            toolbarExtras={
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    className="h-8 px-2 rounded-md text-[11px] font-medium text-foreground hover:bg-muted flex items-center gap-1"
                    title="Margens de impressão (mm)"
                  >
                    <Scaling className="h-3.5 w-3.5" />
                    Margens
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-3" align="end">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2">
                    Margens de impressão (mm)
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <label key={side} className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {side === "top" ? "Superior" : side === "right" ? "Direita" : side === "bottom" ? "Inferior" : "Esquerda"}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={margins[side]}
                          onChange={(e) => setMargins((p) => ({ ...p, [side]: e.target.value }))}
                          className="w-full h-8 px-2 bg-background border border-border rounded-md text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
                          inputMode="decimal"
                        />
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            }
          />
        ) : (
          <div className="a4-stage border border-border/60 rounded-xl">
            <div
              className="prose-mapa a4-sheet text-[13px] leading-snug"
              style={{ fontFamily: '"Courier New", Courier, monospace' }}
              dangerouslySetInnerHTML={{ __html: previewHtml || "<p style='color:#94a3b8;'>Nada para pré-visualizar — escreva algo no editor.</p>" }}
            />
          </div>
        )}
        {tab === "preview" && (
          <p className="pt-2 text-[10px] text-muted-foreground italic">
              Pré-visualização com dados-exemplo. Os valores reais aparecem no laudo final do paciente.
            </p>
        )}
      </div>
    </StandardDialog>
  );
};

export default LayoutDialog;
