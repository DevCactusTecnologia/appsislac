// Aba "Documentos" em /configuracoes.
// Lista templates de documentos por tipo (comprovantes, declarações, cabeçalho, rodapé)
// com criar, editar, duplicar, ativar/desativar, definir como padrão e excluir.
//
// ----------------------------------------------------------------------------
// SISLAC Document Ownership (IA-first semantics)
//   Lab Data  = institutional identity   → /configuracoes → aba "Laboratório".
//   Documents = REUSABLE TEMPLATES (this tab — single source of truth).
//   Receipts  = operational instances    → /atendimentos → Detalhe do Atendimento.
// Templates here are pure structure/branding. Operational receipts are
// rendered by `documentoRenderer.ts` using the active template + lab data.
// ----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Plus, Search, MoreVertical, Edit, Copy,
  Trash2, Power, Star, Eye,
} from "lucide-react";
import SectionShell from "@/components/configuracoes/_shared/SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDocumentoTemplates, subscribeDocumentoTemplates,
  removeDocumentoTemplate, updateDocumentoTemplate, duplicarDocumentoTemplate,
  DOCUMENTO_TIPO_LABELS,
  type DocumentoTemplate, type DocumentoTipo,
} from "@/data/documentoTemplatesStore";
import DocumentoTemplateDialog from "./documentos/DocumentoTemplateDialog";
import PreviewComprovantesDialog from "./PreviewComprovantesDialog";

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const DocumentosTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, force] = useState(0);
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentoTemplate | null>(null);
  const [tipoInicial, setTipoInicial] = useState<DocumentoTipo | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState<DocumentoTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => subscribeDocumentoTemplates(() => force((n) => n + 1)), []);

  const templates = getDocumentoTemplates();

  const filtrados = useMemo(() => {
    const q = normalize(busca);
    if (!q) return templates;
    return templates.filter(
      (t) =>
        normalize(t.nome).includes(q) ||
        normalize(t.descricao).includes(q) ||
        normalize(DOCUMENTO_TIPO_LABELS[t.tipo]).includes(q),
    );
  }, [templates, busca]);

  // Agrupa por tipo
  const grupos = useMemo(() => {
    const m = new Map<DocumentoTipo, DocumentoTemplate[]>();
    for (const t of filtrados) {
      if (!m.has(t.tipo)) m.set(t.tipo, []);
      m.get(t.tipo)!.push(t);
    }
    return m;
  }, [filtrados]);

  const handleNovo = (tipo?: DocumentoTipo) => {
    setEditing(null);
    setTipoInicial(tipo);
    setDialogOpen(true);
  };

  const handleEditar = (t: DocumentoTemplate) => {
    setEditing(t);
    setTipoInicial(undefined);
    setDialogOpen(true);
  };

  const handleDuplicar = async (t: DocumentoTemplate) => {
    const novo = await duplicarDocumentoTemplate(t.id);
    if (novo) toast({ title: "Template duplicado", description: novo.nome });
    else toast({ title: "Falha ao duplicar", variant: "destructive" });
  };

  const handleToggle = async (t: DocumentoTemplate) => {
    const ok = await updateDocumentoTemplate(t.id, { ativo: !t.ativo });
    if (ok) toast({ title: t.ativo ? "Template inativado" : "Template ativado" });
  };

  const handleSetPadrao = async (t: DocumentoTemplate) => {
    const ok = await updateDocumentoTemplate(t.id, { padrao: true, ativo: true });
    if (ok) toast({ title: "Definido como padrão" });
  };

  const handleExcluir = async () => {
    if (!confirmDelete) return;
    const ok = await removeDocumentoTemplate(confirmDelete.id);
    setConfirmDelete(null);
    if (ok) toast({ title: "Template excluído" });
    else toast({ title: "Falha ao excluir", description: "Templates padrão do sistema não podem ser removidos.", variant: "destructive" });
  };

  const tiposOrdem: DocumentoTipo[] = [
    "documento",
    "comprovante_pagamento",
    "comprovante_atendimento",
    "declaracao_comparecimento",
    "orcamento",
    "cabecalho",
    "rodape",
  ];

  return (
    <>
      <SectionShell
        icon={<FileText className="h-5 w-5 text-primary" />}
        title="Documentos"
        description="Crie e personalize templates dos documentos impressos: comprovantes de pagamento e atendimento, declaração de comparecimento, cabeçalho e rodapé. Defina um template padrão por tipo para uso automático."
        meta={<Badge variant="secondary" className="text-[10px]">{templates.length} template(s)</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPreviewOpen(true)}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" /> Pré-visualizar
            </Button>
            <Button onClick={() => handleNovo()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Novo template
            </Button>
          </div>
        }
        toolbar={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, descrição ou tipo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        }
        bodyless
      >
        {filtrados.length === 0 && busca ? (
          <div className="py-16 px-6 text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground">
              Nenhum template encontrado
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tente outro termo de busca.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {tiposOrdem.map((tipo) => {
              const lista = grupos.get(tipo) ?? [];
              if (tipo === "documento" && lista.length === 0) return null;

              return (
                <div key={tipo} className="py-1">
                  <div className="px-5 sm:px-6 py-2 bg-muted/20">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {DOCUMENTO_TIPO_LABELS[tipo]}
                    </p>
                  </div>
                  {lista.length === 0 ? (
                    tipo === "documento" ? null : (
                      <div className="px-5 sm:px-6 py-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg shrink-0 bg-muted">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            Nenhum template cadastrado para este tipo.
                          </p>
                        </div>
                      </div>
                    )
                  ) : lista.map((t) => (
                    <div
                      key={t.id}
                      className="px-5 sm:px-6 py-3.5 flex items-center gap-3 hover:bg-muted/20 transition-colors"
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${t.ativo ? "bg-primary/10" : "bg-muted"}`}>
                        <FileText className={`h-4 w-4 ${t.ativo ? "text-primary" : "text-muted-foreground"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{t.nome}</p>
                          {t.padrao && (
                            <Badge variant="default" className="text-[10px] gap-1">
                              <Star className="h-2.5 w-2.5 fill-current" /> Padrão
                            </Badge>
                          )}
                          {!t.ativo && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                        </div>
                        {t.descricao && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {t.descricao}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleEditar(t)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          {!t.padrao && (
                            <DropdownMenuItem onClick={() => handleSetPadrao(t)}>
                              <Star className="h-3.5 w-3.5 mr-2" /> Definir como padrão
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleDuplicar(t)}>
                            <Copy className="h-3.5 w-3.5 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggle(t)}>
                            <Power className="h-3.5 w-3.5 mr-2" /> {t.ativo ? "Inativar" : "Ativar"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setConfirmDelete(t)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </SectionShell>

      <DocumentoTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        tipoInicial={tipoInicial}
        criadoPor={user?.email ?? ""}
      />

      <PreviewComprovantesDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{confirmDelete?.nome}</strong> será excluído permanentemente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DocumentosTab;
