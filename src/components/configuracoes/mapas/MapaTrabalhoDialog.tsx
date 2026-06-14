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
  "w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all";
const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block";

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

  const headerActions = templatesDoTipo.length > 0 && !loteBloqueado ? (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-9 px-3 rounded-lg border border-primary/30 bg-primary/5 text-[12px] font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-1.5"
          title="Inserir template pronto no editor"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Templates
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-2" align="end">
        <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5">
          Templates {tipo === "INDIVIDUAL" ? "individuais" : "de lote"}
        </p>
        <div className="flex flex-col gap-0.5">
          {templatesDoTipo.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => aplicarTemplate(t.id)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent transition-colors"
            >
              <p className="text-sm font-medium text-foreground">{t.nome}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  ) : null;

  const footer = (
    <>
      <button
        onClick={() => onOpenChange(false)}
        disabled={salvando}
        className="h-10 px-5 rounded-lg border border-border bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        onClick={handleSalvar}
        disabled={salvando}
        className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Save className="h-4 w-4" />
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
      <div className="px-6 py-5 space-y-6">
        {/* SEÇÕES 1 + 2: Tipo do mapa + Identificação na mesma linha */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* SEÇÃO 1: Tipo do mapa — cards compactos */}
          <div>
            <label className={labelClass}>1. Tipo do mapa</label>
            <div className="grid grid-cols-2 gap-2">
              {tiposMapa.map((t) => {
                const Icon = t.icon;
                const ativo = tipo === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    title={`${t.description} — ${t.hint}`}
                    className={`relative text-left px-3 py-2.5 rounded-lg border transition-all ${
                      ativo
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background hover:border-border/80 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`shrink-0 h-8 w-8 rounded-md flex items-center justify-center ${
                          ativo ? "bg-primary/10" : "bg-muted"
                        }`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${
                            ativo ? "text-primary" : "text-muted-foreground"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13px] font-semibold text-foreground truncate">
                            {t.label}
                          </p>
                          {ativo && (
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {t.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEÇÃO 2: Identificação */}
          <div>
            <label className={labelClass}>2. Identificação</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              readOnly={!!mapa?.sistema}
              className={inputClass + (mapa?.sistema ? " opacity-70 cursor-not-allowed" : "")}
              placeholder="Nome do mapa (ex.: Mapa de Hemograma)"
              autoFocus
            />
            {mapa?.sistema && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Mapa do sistema — o nome não pode ser alterado, mas o conteúdo e os vínculos podem ser editados normalmente.
              </p>
            )}
          </div>
        </div>

        {/* SEÇÃO 3: Layout — tabs editor / preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>3. Layout do mapa</label>
            <div className="flex items-center gap-2">
              {validacao.used.length > 0 && (
                <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground">
                  {validacao.used.length} variável(is)
                </span>
              )}
              {!validacao.valid && (
                <span className="text-[10px] font-medium px-2 py-1 rounded-md bg-destructive/10 text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {validacao.invalid.length} inválida(s)
                </span>
              )}
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-card">
            {/* Tabs interno */}
            <div className="flex items-center border-b border-border bg-muted/20">
              <button
                onClick={() => !loteBloqueado && setTab("editor")}
                disabled={loteBloqueado}
                title={loteBloqueado ? "O Mapa do Analista (Lote) tem renderização automática — o editor está bloqueado." : undefined}
                className={`h-9 px-4 text-[12px] font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                  tab === "editor"
                    ? "border-primary text-foreground bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                } ${loteBloqueado ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {loteBloqueado ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} Editor
              </button>
              <button
                onClick={() => setTab("preview")}
                className={`h-9 px-4 text-[12px] font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                  tab === "preview"
                    ? "border-primary text-foreground bg-background"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Eye className="h-3.5 w-3.5" /> Pré-visualização
              </button>
              {loteBloqueado && (
                <span className="ml-auto mr-3 text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3 w-3" />
                  Renderização automática
                </span>
              )}
            </div>

            {!validacao.valid && (
              <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">
                <strong>Variáveis não reconhecidas:</strong>{" "}
                {validacao.invalid.map((v) => `{{${v}}}`).join(", ")}
              </div>
            )}

            {tab === "editor" && !loteBloqueado ? (
              <CKEditor
                value={conteudo}
                onChange={setConteudo}
                placeholder="Comece a digitar ou aplique um template…"
              />
            ) : (
              <div className="flex flex-col">
                {loteBloqueado && (
                  <div className="flex items-start gap-2 px-4 py-2.5 bg-primary/5 border-b border-primary/15 text-[11px] text-foreground/80">
                    <Lock className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>
                      O <strong>Mapa do Analista — Lote</strong> tem layout fixo e dinâmico:
                      a tabela é montada automaticamente a partir dos pacientes, exames e
                      parâmetros do dia. Por isso a edição do HTML está bloqueada.
                    </span>
                  </div>
                )}
                {/* Barra de orientação A4 */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20">
                  <p className="text-[11px] text-muted-foreground italic">
                    Pré-visualização A4 com dados fictícios — fiel ao PDF gerado.
                  </p>
                  <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/30">
                    <button
                      type="button"
                      onClick={() => setPreviewOrientation("portrait")}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                        previewOrientation === "portrait"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
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
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                        previewOrientation === "landscape"
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      aria-label="Orientação paisagem"
                    >
                      <RectangleHorizontal className="h-3 w-3" />
                      Paisagem
                    </button>
                  </div>
                </div>
                <div className="bg-muted/30 h-[520px] overflow-auto">
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
