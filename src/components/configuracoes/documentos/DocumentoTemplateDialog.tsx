// Dialog para criar / editar um template de documento.
// O editor rich-text foi removido; usa placeholder até o novo editor ser integrado.

import { useEffect, useMemo, useState } from "react";
import StandardDialog from "@/components/ui/standard-dialog";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import CKEditor from "@/components/editor/CKEditor";
import { normalizeMapaHtml } from "@/lib/mapaSharedStyles";
import { useToast } from "@/hooks/use-toast";
import {
  addDocumentoTemplate, updateDocumentoTemplate,
  DOCUMENTO_TIPO_LABELS,
  type DocumentoTemplate, type DocumentoTipo,
} from "@/data/documentoTemplatesStore";
import { DOCUMENTO_PLACEHOLDERS, renderCabecalhoPadrao, renderRodapePadrao } from "@/lib/documentoRenderer";
import { renderPlaceholders } from "@/lib/mapaPlaceholders";
import { getTemplatePadraoHtml, removerLinhasHorizontaisDocumento } from "@/lib/documentoTemplatesPadrao";
import { buildDocumentoFooterHtml, type ComprovanteTipo } from "@/lib/comprovantes";
import { getLabConfig } from "@/data/labConfigStore";
import { fmtBRL } from "@/lib/utils";
import { Eye, Pencil, FileText, Save, Scaling, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: DocumentoTemplate | null;
  tipoInicial?: DocumentoTipo;
  criadoPor: string;
  onSaved?: (t: DocumentoTemplate) => void;
}

const tiposOptions: DocumentoTipo[] = [
  "comprovante_pagamento",
  "comprovante_atendimento",
  "declaracao_comparecimento",
  "orcamento",
  "cabecalho",
  "rodape",
  "documento",
];

const inputClass =
  "w-full h-10 px-3 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all";
const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 block";

const DocumentoTemplateDialog = ({
  open, onOpenChange, template, tipoInicial, criadoPor, onSaved,
}: Props) => {
  const { toast } = useToast();
  const [tipo, setTipo] = useState<DocumentoTipo>(tipoInicial ?? "comprovante_pagamento");
  const [nome, setNome] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [padrao, setPadrao] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [margins, setMargins] = useState<{ top: string; right: string; bottom: string; left: string }>({
    top: "18", right: "18", bottom: "22", left: "18",
  });

  useEffect(() => {
    if (!open) return;
    setTab("editor");
    if (template) {
      setTipo(template.tipo);
      setNome(template.nome);
      // Se o template salvo está vazio, carrega o layout padrão do tipo
      // para que o usuário sempre veja o documento renderizado.
      setConteudo(removerLinhasHorizontaisDocumento(template.conteudo?.trim() ? template.conteudo : getTemplatePadraoHtml(template.tipo)));
      setAtivo(template.ativo);
      setPadrao(template.padrao);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = (template.config as any)?.margins ?? {};
      setMargins({
        top: String(m.top ?? 18),
        right: String(m.right ?? 18),
        bottom: String(m.bottom ?? 22),
      left: String(m.left ?? 18),
      });
    } else {
      const t = tipoInicial ?? "comprovante_pagamento";
      setTipo(t);
      setNome("");
      setConteudo(removerLinhasHorizontaisDocumento(getTemplatePadraoHtml(t)));
      setAtivo(true);
      setPadrao(false);
      setMargins({ top: "18", right: "18", bottom: "22", left: "18" });
    }
  }, [open, template, tipoInicial]);

  // Quando o usuário troca o TIPO e o conteúdo ainda está vazio (ou é
  // exatamente o padrão de outro tipo), recarrega o padrão do novo tipo.
  const handleTipoChange = (novo: DocumentoTipo) => {
    setTipo(novo);
    const atual = conteudo.trim();
    const ehPadraoDeOutro = Object.values<string>(
      // qualquer template padrão conhecido
      { p: getTemplatePadraoHtml("comprovante_pagamento"),
        a: getTemplatePadraoHtml("comprovante_atendimento"),
        c: getTemplatePadraoHtml("declaracao_comparecimento"),
        o: getTemplatePadraoHtml("orcamento") },
    ).some((html) => html.trim() === atual);
    if (!atual || ehPadraoDeOutro) {
      setConteudo(removerLinhasHorizontaisDocumento(getTemplatePadraoHtml(novo)));
    }
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const sanitize = (v: string, fb: number) => {
      const n = Number(String(v).replace(",", "."));
      return Number.isFinite(n) && n >= 0 ? Math.min(50, Math.round(n * 10) / 10) : fb;
    };
    const marginsConfig = {
      top: sanitize(margins.top, 18),
      right: sanitize(margins.right, 18),
      bottom: sanitize(margins.bottom, 22),
      left: sanitize(margins.left, 18),
    };
    try {
      if (template) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prevConfig = (template.config as any) ?? {};
        const ok = await updateDocumentoTemplate(template.id, {
          tipo, nome: nome.trim(), descricao: template.descricao ?? "",
          conteudo: removerLinhasHorizontaisDocumento(conteudo), ativo, padrao,
          config: { ...prevConfig, margins: marginsConfig },
        });
        if (ok) {
          toast({ title: "Template atualizado" });
          onOpenChange(false);
        } else {
          toast({ title: "Falha ao atualizar", variant: "destructive" });
        }
      } else {
        const novo = await addDocumentoTemplate({
          tipo, nome: nome.trim(), descricao: "",
          conteudo: removerLinhasHorizontaisDocumento(conteudo),
          config: { margins: marginsConfig },
          ativo, padrao, criadoPor,
        });
        if (novo) {
          toast({ title: "Template criado" });
          onSaved?.(novo);
          onOpenChange(false);
        } else {
          toast({ title: "Falha ao criar", variant: "destructive" });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // Dados de exemplo (mock) para gerar a pré-visualização do template.
  const previewHtml = useMemo(() => {
    if (!conteudo.trim()) return "";
    const lab = getLabConfig();
    const sample = {
      paciente: {
        nome: "Maria Silva Souza",
        cpf: "123.456.789-00",
        nascimento: "12/05/1985",
        idade: "39 anos",
        sexo: "Feminino",
      },
      atendimento: {
        protocolo: "AT-2026-000123",
        data: new Date().toLocaleDateString("pt-BR"),
        prioridade: "Normal",
      },
      protocolo: "AT-2026-000123",
      convenio: { nome: "Particular" },
      solicitante: { nome: "Dr. João Pereira" },
      unidade: {
        nome: "Unidade Centro",
        endereco: "Rua das Flores, 100",
        cidade: "São Paulo",
        estado: "SP",
        telefone: "(11) 4002-8922",
      },
      laboratorio: {
        nome: lab.nome || "—",
        razaoSocial: lab.razaoSocial || lab.nome || "—",
        cnpj: lab.cnpj || "—",
        telefone: lab.telefone || "—",
        email: lab.email || "—",
        endereco: lab.endereco || "—",
        cidade: lab.cidade || "—",
        estado: lab.estado || "—",
        cnes: lab.cnes || "—",
        inscricaoMunicipal: lab.inscricaoMunicipal || "—",
        responsavelTecnico: lab.responsavelTecnico || "—",
        responsavelTecnicoConselho: lab.responsavelTecnicoConselho || "",
        responsavelTecnicoNumero: lab.responsavelTecnicoNumero || "",
        responsavelTecnicoUf: lab.responsavelTecnicoUf || "",
        logo: lab.logo || "",
      },
      sistema: {
        dataImpressao: new Date().toLocaleString("pt-BR"),
        usuario: "preview",
      },
      exames: {
        lista: `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr>
            <th style="text-align:left;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Exame</th>
            <th style="text-align:left;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Material</th>
            <th style="text-align:right;padding:6px 10px;background:#f5f5f8;font-size:10px;text-transform:uppercase;color:#666;">Valor</th>
          </tr></thead>
          <tbody>
            <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">Hemograma Completo</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Sangue total</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(45)}</td></tr>
            <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">Glicemia em jejum</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Soro</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(25)}</td></tr>
            <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">TSH</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">Soro</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(60)}</td></tr>
          </tbody>
        </table>`,
      },
      pagamentos: {
        lista: `<table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tbody>
            <tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">Pix</td><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;">${new Date().toLocaleDateString("pt-BR")}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${fmtBRL(80)}</td></tr>
          </tbody>
        </table>`,
      },
      totais: {
        subtotal: fmtBRL(130),
        desconto: fmtBRL(0),
        pago: fmtBRL(80),
        total: fmtBRL(130),
        saldo: fmtBRL(50),
      },
    };
    // Placeholders de "bloco" (que serão substituídos por <table>) não podem
    // ficar dentro de <p>…</p> — o navegador "expulsaria" a tabela quebrando o layout.
    // Removemos o <p> wrapper apenas quando ele contém só o placeholder de bloco.
    const BLOCK_PLACEHOLDERS = ["exames.lista", "pagamentos.lista"];
    let html = normalizeMapaHtml(removerLinhasHorizontaisDocumento(conteudo));
    for (const tag of BLOCK_PLACEHOLDERS) {
      const re = new RegExp(
        `<p[^>]*>\\s*(\\{\\{\\s*${tag.replace(".", "\\.")}\\s*\\}\\})\\s*</p>`,
        "g",
      );
      html = html.replace(re, "$1");
    }
    const corpo = renderPlaceholders(html, sample);

    // Anexa o rodapé padrão (QR + cód. verificação + assinatura RT) — mesmo
    // comportamento do renderer real para que a pré-visualização reflita
    // exatamente o documento que será impresso.
    const tipoToComprovante: Partial<Record<DocumentoTipo, ComprovanteTipo>> = {
      comprovante_pagamento: "pagamento",
      comprovante_atendimento: "atendimento",
      declaracao_comparecimento: "comparecimento",
    };
    const compTipo = tipoToComprovante[tipo];
    const rodapePadrao = compTipo
      ? buildDocumentoFooterHtml({
          tipo: compTipo,
          protocolo: sample.atendimento.protocolo,
          data: sample.atendimento.data,
          paciente: sample.paciente,
          convenio: sample.convenio.nome,
          solicitante: sample.solicitante.nome,
          unidade: sample.unidade,
          exames: [
            { nome: "Hemograma Completo", material: "Sangue total", valor: 45 },
            { nome: "Glicemia em jejum", material: "Soro", valor: 25 },
            { nome: "TSH", material: "Soro", valor: 60 },
          ],
          pagamentos: [
            { tipo: "Pix", data: new Date().toLocaleDateString("pt-BR"), valor: 80 },
          ],
          totais: { subtotal: 130, desconto: 0, pago: 80, total: 130, saldo: 50 },
        })
      : "";

    const ctx = {
      paciente: sample.paciente,
      atendimento: {
        protocolo: sample.atendimento.protocolo,
        data: sample.atendimento.data,
        convenio: sample.convenio.nome,
        solicitante: sample.solicitante.nome,
      },
      unidade: sample.unidade,
      totais: { subtotal: 130, desconto: 0, pago: 80, total: 130, saldo: 50 },
    };

    const header = (template?.config as any)?.exibirCabecalho ? renderCabecalhoPadrao(ctx) : "";
    const footer = (template?.config as any)?.exibirRodape ? renderRodapePadrao(ctx) : "";

    return `
      <div style="font-family:'Inter','Segoe UI',system-ui,sans-serif;color:#1a1a2e;background:#fff;padding:20px;border-radius:12px;">
        ${header}
        <div class="documento-corpo">${corpo}</div>
        ${rodapePadrao}
        ${footer}
      </div>
    `;
  }, [conteudo, tipo, template?.config]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
      <button
        type="button"
        onClick={() => setTab("editor")}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md transition-colors ${
          tab === "editor"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" /> Editor
      </button>
      <button
        type="button"
        onClick={() => setTab("preview")}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md transition-colors ${
          tab === "preview"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye className="h-3.5 w-3.5" /> Pré-visualizar
      </button>
      </div>
    </div>
  );

  const footer = (
    <>
      <button
        onClick={() => onOpenChange(false)}
        disabled={saving}
        className="h-10 px-5 rounded-lg border border-border bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        onClick={handleSave}
        disabled={saving}
        className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        <Save className="h-4 w-4" />
        {saving ? "Salvando..." : template ? "Salvar alterações" : "Criar template"}
      </button>
    </>
  );

  return (
    <StandardDialog
      open={open}
      onClose={() => onOpenChange(false)}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title={template ? "Editar template" : "Novo template de documento"}
      subtitle="Configure o conteúdo e o estilo do documento gerado pelo sistema"
      headerActions={headerActions}
      footer={footer}
      maxWidth="5xl"
      allowMaximize
      defaultMaximized={true}
    >
      <div className="px-6 py-5 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,0.9fr)_minmax(260px,1.1fr)_auto_auto] gap-4 items-end">
          <div>
            <label className={labelClass}>1. Tipo de documento</label>
            <Select value={tipo} onValueChange={(v) => handleTipoChange(v as DocumentoTipo)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposOptions.map((t) => (
                  <SelectItem key={t} value={t}>{DOCUMENTO_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelClass}>2. Nome do template</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              placeholder="Ex.: Recibo padrão 2026"
              className={inputClass}
              autoFocus
            />
        </div>

          <label className="flex items-center justify-between gap-2 text-xs font-medium h-10 px-3 rounded-lg border border-border bg-background cursor-pointer sm:min-w-[104px]">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            Ativo
          </label>
          <label className="flex items-center justify-between gap-2 text-xs font-medium h-10 px-3 rounded-lg border border-border bg-background cursor-pointer sm:min-w-[112px]">
            <Switch checked={padrao} onCheckedChange={setPadrao} />
            Padrão
          </label>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${labelClass} mb-0`}>3. Conteúdo do documento</label>
            <p className="text-[10px] text-muted-foreground">
              {tab === "editor"
                ? 'Use "Inserir campo" para adicionar dados dinâmicos.'
                : "Valores fictícios apenas para visualização."}
            </p>
          </div>
          <div className="border border-border rounded-lg overflow-hidden bg-card min-w-0">
            {tab === "editor" ? (
              <div className="flex flex-col">
                <div className="flex items-center justify-end gap-2 border-b border-border bg-muted/30 px-2 py-1.5">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
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
                </div>
                <CKEditor
                  value={removerLinhasHorizontaisDocumento(conteudo)}
                  onChange={(html) => setConteudo(removerLinhasHorizontaisDocumento(html))}
                />
              </div>
            ) : (
              <div className="a4-stage">
                {conteudo.trim() ? (
                  <div
                    className="prose-mapa prose-mapa-document a4-sheet text-[13px] leading-snug"
                    style={{ fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-12">
                    Nada para pré-visualizar — escreva o conteúdo no editor.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </StandardDialog>
  );
};

export default DocumentoTemplateDialog;
