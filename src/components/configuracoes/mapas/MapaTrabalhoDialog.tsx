// Dialog de criação/edição de Mapa de Trabalho.
// Redesign 2026-04: padrão Lovable minimalist flat com seleção de tipo via cards,
// editor visual de tabela e preview lado-a-lado.

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Sparkles, Eye, Pencil, AlertTriangle, Save, ChevronDown,
  User, Layers, CheckCircle2, RectangleVertical, RectangleHorizontal, Lock,
} from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import CKEditor from "@/components/editor/CKEditor";
import {
  addMapaTrabalho, updateMapaTrabalho, type MapaTrabalho, type MapaTipo,
} from "@/data/mapaTrabalhoStore";
import { MAPA_TEMPLATES } from "@/lib/mapaTemplates";
import { renderPlaceholders, validatePlaceholders } from "@/lib/mapaPlaceholders";
import { wrapHtmlAsA4Preview, type MapaOrientation } from "@/lib/mapaA4Preview";
import { buildLotePreviewBlock } from "@/lib/mapaLotePreview";
import { cn } from "@/lib/utils";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mapa: MapaTrabalho | null;
  criadoPor?: string;
  onSaved?: (mapa: MapaTrabalho) => void;
}

interface TipoMapaCard {
  value: MapaTipo;
  label: string;
  description: string;
  icon: typeof User;
  hint: string;
}

const tiposMapa: TipoMapaCard[] = [
  {
    value: "INDIVIDUAL",
    label: "Individual",
    description: "Layout próprio para um exame específico",
    icon: User,
    hint: "Ex.: HIV, URINA DE JATO MÉDIO, HEMOGRAMA",
  },
  {
    value: "LOTE",
    label: "Lote",
    description: "Agrupa vários exames em uma única folha tabular",
    icon: Layers,
    hint: "Ex.: Mapa do Analista — todos os exames do dia",
  },
];

// Dados fictícios para preview
const PREVIEW_DATA = {
  paciente: {
    nome: "MARIA SILVA EXEMPLO",
    idade: "42 anos",
    sexo: "Feminino",
    cpf: "000.000.000-00",
    nascimento: "01/01/1983",
  },
  protocolo: "ATD-2026-0001234",
  guia: "GUIA-001",
  ordem: "1",
  atendimento: { data: "20/04/2026" },
  convenio: { nome: "Particular" },
  exame: { nome: "HEMOGRAMA COMPLETO", codigo: "HEM01", material: "Sangue total" },
  sistema: {
    dataImpressao: new Date().toLocaleDateString("pt-BR"),
    usuario: "Operador Demo",
  },
};

const inputClass =
  "w-full h-9 px-3 bg-background border border-border rounded-md text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all";
const labelClass = "text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80 mb-1.5 block";

const MapaTrabalhoDialog = ({ open, onOpenChange, mapa, criadoPor, onSaved }: Props) => {
  const { toast } = useToast();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<MapaTipo>("LOTE");
  const [conteudo, setConteudo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [previewOrientation, setPreviewOrientation] = useState<MapaOrientation>("portrait");

  // Mapas LOTE têm renderização automática (layout fixo do "Mapa do Analista").
  // O HTML do editor é ignorado pelo motor de impressão — bloqueamos a edição
  // do conteúdo para evitar confusão.
  const loteBloqueado = tipo === "LOTE";

  useEffect(() => {
    if (open) {
      setNome(mapa?.nome ?? "");
      setDescricao(mapa?.descricao ?? "");
      const t = (mapa?.tipo ?? "LOTE") as MapaTipo;
      setTipo(t);
      setConteudo(mapa?.conteudo ?? "");
      setTab(t === "LOTE" ? "preview" : "editor");
    }
  }, [open, mapa]);

  // Sempre que o usuário alterna para LOTE, força a tab de pré-visualização.
  useEffect(() => {
    if (loteBloqueado && tab !== "preview") setTab("preview");
  }, [loteBloqueado, tab]);

  const validacao = useMemo(() => validatePlaceholders(conteudo), [conteudo]);
  const previewHtml = useMemo(
    () =>
      tipo === "LOTE"
        // Para mapas LOTE, simulamos vários pacientes/exames usando o MESMO
        // motor de impressão da página /mapa — assim a aba "Pré-visualização"
        // mostra exatamente como ficará com vários atendimentos reais.
        ? buildLotePreviewBlock(conteudo)
        : renderPlaceholders(conteudo, PREVIEW_DATA),
    [conteudo, tipo]
  );
  const previewA4Html = useMemo(
    () => wrapHtmlAsA4Preview(previewHtml, previewOrientation),
    [previewHtml, previewOrientation]
  );

  // Templates filtrados pelo tipo selecionado
  const templatesDoTipo = useMemo(
    () => MAPA_TEMPLATES.filter((t) => t.tipo === tipo),
    [tipo]
  );

  const aplicarTemplate = (templateId: string) => {
    const t = MAPA_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return;
    setConteudo(t.conteudo);
    setTipo(t.tipo);
    if (!nome) setNome(t.nome);
    toast({
      title: "Template aplicado",
      description: `"${t.nome}" carregado no editor.`,
    });
  };

  const handleSalvar = async () => {
    const nomeNorm = nome.trim();
    if (!nomeNorm) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (!validacao.valid) {
      toast({
        title: "Variáveis inválidas no template",
        description: `Remova: ${validacao.invalid.join(", ")}`,
        variant: "destructive",
      });
      return;
    }
    setSalvando(true);
    if (mapa) {
      const ok = await updateMapaTrabalho(mapa.id, {
        nome: nomeNorm,
        descricao: descricao.trim(),
        tipo,
        conteudo,
      });
      setSalvando(false);
      if (ok) {
        toast({ title: "Mapa atualizado" });
        onSaved?.({
          ...mapa,
          nome: nomeNorm,
          descricao,
          tipo,
          conteudo,
        });
        onOpenChange(false);
      } else {
        toast({ title: "Falha ao salvar", variant: "destructive" });
      }
    } else {
      const novo = await addMapaTrabalho({
        nome: nomeNorm,
        descricao: descricao.trim(),
        tipo,
        conteudo,
        isCatchAll: false,
        ativo: true,
        sistema: false,
        criadoPor: criadoPor ?? "",
        // LEGACY_RESERVED — sem runtime ativo; valores padrão para satisfazer o tipo.
        templateKey: "auto",
        source: "legacy_html",
        layoutJson: {},
        config: {},
      });
      setSalvando(false);
      if (novo) {
        toast({
          title: "Mapa criado",
          description: "Agora vincule os exames que devem usar este mapa.",
        });
        onSaved?.(novo);
        onOpenChange(false);
      } else {
        toast({ title: "Falha ao criar mapa", variant: "destructive" });
      }
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Tipo — segmented compacto */}
      <div className="inline-flex h-9 p-0.5 bg-muted/50 border border-border/60 rounded-md">
        {tiposMapa.map((t) => {
          const Icon = t.icon;
          const ativo = tipo === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTipo(t.value)}
              title={`${t.description} — ${t.hint}`}
              className={cn(
                "flex items-center gap-1.5 px-3 rounded text-[12.5px] font-medium transition-all",
                ativo
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {ativo && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        maxLength={120}
        readOnly={!!mapa?.sistema}
        placeholder="Nome do mapa"
        title="Nome do mapa"
        className={
          "h-9 w-[240px] px-3 bg-background border border-border rounded-md text-[12.5px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all" +
          (mapa?.sistema ? " opacity-70 cursor-not-allowed" : "")
        }
      />

      {templatesDoTipo.length > 0 && !loteBloqueado && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-9 px-3 rounded-md text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
              title="Inserir template pronto no editor"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Templates
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] p-1.5" align="end">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80 px-2 py-1.5">
              Templates {tipo === "INDIVIDUAL" ? "individuais" : "de lote"}
            </p>
            <div className="flex flex-col gap-0.5">
              {templatesDoTipo.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => aplicarTemplate(t.id)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <p className="text-[13px] font-medium text-foreground">{t.nome}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.descricao}</p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );

  const footer = (
    <>
      <button
        onClick={() => onOpenChange(false)}
        disabled={salvando}
        className="h-9 px-4 rounded-md text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[12.5px] font-semibold flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Save className="h-3.5 w-3.5" />
        {salvando ? "Salvando..." : mapa ? "Salvar alterações" : "Criar mapa"}
      </button>
    </>
  );

  return (
    <StandardDialog
      open={open}
      onClose={() => onOpenChange(false)}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title={mapa ? "Editar mapa de trabalho" : "Novo mapa de trabalho"}
      subtitle={
        mapa
          ? mapa.nome
          : "Defina o tipo, monte o layout com variáveis e visualize antes de salvar"
      }
      headerActions={headerActions}
      footer={footer}
      maxWidth="5xl"
      allowMaximize
    >
      <div className="px-5 py-4 space-y-3">
        {mapa?.sistema && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Mapa do sistema — nome bloqueado. Conteúdo e vínculos podem ser editados.
          </p>
        )}

        {!validacao.valid && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-md px-3 py-1.5 text-[11px] text-destructive">
            <strong>Variáveis não reconhecidas:</strong>{" "}
            {validacao.invalid.map((v) => `{{${v}}}`).join(", ")}
          </div>
        )}

        <div>
          {/* Tabs bar — sempre visível, acima do editor/preview (mesmo padrão de Documentos) */}
          <div className="flex items-center justify-between px-3 py-1.5 border border-border border-b-0 rounded-t-lg bg-muted/20">
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => !loteBloqueado && setTab("editor")}
                disabled={loteBloqueado}
                title={loteBloqueado ? "O Mapa do Analista (Lote) tem renderização automática." : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-[5px] transition-colors",
                  tab === "editor" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  loteBloqueado && "opacity-50 cursor-not-allowed",
                )}
              >
                {loteBloqueado ? <Lock className="h-3 w-3" /> : <Pencil className="h-3 w-3" />} Editor
              </button>
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded-[5px] transition-colors",
                  tab === "preview" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Eye className="h-3 w-3" /> Pré-visualizar
              </button>
            </div>
            {tab === "preview" && (
              <div className="inline-flex h-7 p-0.5 bg-muted/50 border border-border/60 rounded">
                <button
                  type="button"
                  onClick={() => setPreviewOrientation("portrait")}
                  className={cn(
                    "flex items-center gap-1 px-2 rounded-sm text-[10.5px] font-medium transition-all",
                    previewOrientation === "portrait" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Orientação retrato"
                >
                  <RectangleVertical className="h-3 w-3" />
                  Retrato
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOrientation("landscape")}
                  className={cn(
                    "flex items-center gap-1 px-2 rounded-sm text-[10.5px] font-medium transition-all",
                    previewOrientation === "landscape" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-label="Orientação paisagem"
                >
                  <RectangleHorizontal className="h-3 w-3" />
                  Paisagem
                </button>
              </div>
            )}
            {tab === "editor" && validacao.used.length > 0 && (
              <span className="hidden md:inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded text-muted-foreground">
                {validacao.used.length} var.
              </span>
            )}
          </div>

          <div className="border border-border border-t-0 rounded-b-lg overflow-hidden bg-card min-w-0">
            {tab === "editor" && !loteBloqueado ? (
              <CKEditor
                value={conteudo}
                onChange={setConteudo}
                placeholder="Comece a digitar ou aplique um template…"
              />
            ) : (
              <div className="flex flex-col">
                {loteBloqueado && (
                  <div className="flex items-start gap-2 px-3 py-2 bg-primary/5 border-b border-primary/15 text-[11px] text-foreground/80">
                    <Lock className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                    <span>
                      O <strong>Mapa do Analista — Lote</strong> tem layout fixo e dinâmico: a tabela é montada automaticamente a partir dos pacientes, exames e parâmetros do dia.
                    </span>
                  </div>
                )}
                <div className="bg-muted/30 h-[560px] overflow-auto">
                  {previewHtml ? (
                    <iframe
                      key={previewOrientation}
                      title="Pré-visualização A4 do mapa"
                      srcDoc={previewA4Html}
                      className="w-full h-full border-0 bg-background"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic px-6 text-center">
                      Nada para pré-visualizar — escreva algo no editor ou aplique um template.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </StandardDialog>
  );
};

export default MapaTrabalhoDialog;
