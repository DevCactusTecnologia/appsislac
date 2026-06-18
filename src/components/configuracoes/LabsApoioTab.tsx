import { useState, useEffect, useMemo } from "react";
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Phone,
  Mail,
  User,
  FlaskConical,
  Link2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StandardDialog from "@/components/ui/standard-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  type LabApoio,
  getLabsApoio,
  addLabApoio,
  updateLabApoio,
  removeLabApoio,
  toggleLabApoio,
} from "@/data/labApoioStore";
import {
  getExamesCatalogo,
  updateExameCatalogo,
} from "@/data/exameCatalogoStore";
import SectionShell from "./_shared/SectionShell";
import Toolbar from "./_shared/Toolbar";
import EmptyState from "./_shared/EmptyState";
import MapeamentoExamesDialog from "./MapeamentoExamesDialog";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10)
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};

type FormData = Omit<LabApoio, "id">;
const emptyForm: FormData = {
  nome: "",
  sigla: "",
  cnpj: "",
  telefone: "",
  email: "",
  contato: "",
  ativo: true,
  integrationId: null,
};

const labelClass =
  "text-[10px] font-bold text-muted-foreground uppercase tracking-widest";
const inputClass =
  "rounded-xl h-10 text-sm border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/40";

const LabsApoioTab = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [labs, setLabs] = useState<LabApoio[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapeamentoOpen, setMapeamentoOpen] = useState<LabApoio | null>(null);
  const [integrations, setIntegrations] = useState<Array<{ id: string; provider: string; mode: string }>>([]);
  const [editando, setEditando] = useState<LabApoio | null>(null);
  const [removerAlvo, setRemoverAlvo] = useState<LabApoio | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const reload = () => setLabs(getLabsApoio());
  useEffect(() => {
    reload();
    (async () => {
      const { data } = await supabase.from("integrations").select("id, provider, mode").order("provider");
      setIntegrations((data as Array<{ id: string; provider: string; mode: string }> | null) ?? []);
    })();
  }, []);

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return labs;
    return labs.filter(
      (l) => normalize(l.nome).includes(q) || normalize(l.sigla ?? "").includes(q) || l.cnpj.includes(search)
    );
  }, [labs, search]);

  const handleNovo = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEditar = (lab: LabApoio) => {
    setEditando(lab);
    const { id, ...rest } = lab;
    setForm(rest);
    setDialogOpen(true);
  };

  const confirmarRemover = async () => {
    if (!removerAlvo) return;
    // Fonte oficial: tipo_processo + lab_apoio_id (campo `analise` é legado).
    const vinculados = getExamesCatalogo().filter(
      (e) => e.tipoProcesso === "TERCEIRIZADO" && e.labApoioId === removerAlvo.id,
    );
    for (const e of vinculados) {
      await updateExameCatalogo(e.id, { tipoProcesso: "INTERNO", labApoioId: null });
    }
    const ok = await removeLabApoio(removerAlvo.id);
    reload();
    if (!ok) { toast({ title: "Falha ao remover laboratório", variant: "destructive" }); return; }
    toast({
      title: "Laboratório removido",
      description: `${vinculados.length} exame(s) vinculado(s) foram movidos para INTERNO.`,
    });
    setRemoverAlvo(null);
  };

  const handleToggle = async (id: string) => {
    const ok = await toggleLabApoio(id);
    reload();
    if (!ok) toast({ title: "Falha ao alterar status", variant: "destructive" });
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    if (editando) {
      const ok = await updateLabApoio(editando.id, form);
      if (!ok) { toast({ title: "Falha ao atualizar laboratório", variant: "destructive" }); return; }
      toast({ title: "Laboratório atualizado" });
    } else {
      const created = await addLabApoio(form);
      if (!created) { toast({ title: "Falha ao cadastrar laboratório", variant: "destructive" }); return; }
      toast({ title: "Laboratório cadastrado" });
    }
    reload();
    setDialogOpen(false);
  };

  return (
    <SectionShell
      icon={<Building className="h-5 w-5 text-primary" />}
      title="Apoio Laboratorial"
      description="Cadastro dos laboratórios parceiros. Vincule exames pelo catálogo de Exames."
      meta={
        <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
          {labs.length} lab{labs.length !== 1 ? "s" : ""}
        </span>
      }
      actions={
        <Button className="rounded-xl text-xs h-9 gap-2" onClick={handleNovo}>
          <Plus className="h-3.5 w-3.5" />
          Novo laboratório
        </Button>
      }
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar laboratório por nome ou CNPJ..."
        />
      }
      bodyless
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Nenhum laboratório encontrado"
          description={
            search
              ? "Tente ajustar a busca."
              : "Cadastre o primeiro laboratório de apoio para começar."
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((lab) => {
            // Fonte oficial: tipo_processo + lab_apoio_id (campo `analise` é legado).
            const examesVinculados = getExamesCatalogo().filter(
              (e) => e.tipoProcesso === "TERCEIRIZADO" && e.labApoioId === lab.id,
            );
            return (
              <div
                key={lab.id}
                className={`px-5 sm:px-6 py-4 hover:bg-muted/20 transition-colors ${
                  !lab.ativo ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {lab.nome}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                          lab.ativo
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {lab.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {examesVinculados.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold flex items-center gap-1">
                          <FlaskConical className="h-2.5 w-2.5" />
                          {examesVinculados.length} exame
                          {examesVinculados.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-mono">{lab.cnpj || "—"}</span>
                      {lab.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lab.telefone}
                        </span>
                      )}
                      {lab.email && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{lab.email}</span>
                        </span>
                      )}
                      {lab.contato && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {lab.contato}
                        </span>
                      )}
                    </div>
                    {/* Exames vinculados */}
                    {examesVinculados.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {examesVinculados.slice(0, 8).map((e) => (
                          <span
                            key={e.id}
                            className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-[11px] font-medium"
                          >
                            {e.mnemonico}
                          </span>
                        ))}
                        {examesVinculados.length > 8 && (
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium">
                            +{examesVinculados.length - 8}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => navigate("/configuracoes?tab=exames")}
                      className="h-9 px-3 rounded-lg bg-muted hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5"
                      title="Vincular exames a este apoio acontece no catálogo de Exames"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Catálogo
                    </button>
                    <button
                      onClick={() => setMapeamentoOpen(lab)}
                      className={`h-9 px-3 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1.5 ${
                        lab.integrationId
                          ? "bg-status-info/10 hover:bg-status-info/20 text-status-info"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                      title={lab.integrationId ? "Mapeamento de exames (integração)" : "Sem integração vinculada"}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      Mapeamento
                    </button>
                    <button
                      onClick={() => handleEditar(lab)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggle(lab.id)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors"
                      title={lab.ativo ? "Desativar" : "Ativar"}
                    >
                      {lab.ativo ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => !lab.sistema && setRemoverAlvo(lab)}
                      disabled={lab.sistema}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        lab.sistema 
                          ? "opacity-50 cursor-not-allowed text-muted-foreground" 
                          : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      )}
                      title={lab.sistema ? "Laboratório padrão do sistema não pode ser removido" : "Remover"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog cadastro */}
      <StandardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={<Building className="h-5 w-5 text-primary" />}
        title={editando ? "Editar laboratório" : "Novo laboratório de apoio"}
        subtitle="Dados do laboratório terceirizado"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setDialogOpen(false)}
              className="h-11 px-6 rounded-2xl border border-border bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              {editando ? "Atualizar" : "Cadastrar"}
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Nome *</label>
              <Input
                className={inputClass}
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: LabExpert Diagnósticos"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Sigla</label>
              <Input
                className={`${inputClass} uppercase`}
                value={form.sigla}
                maxLength={12}
                onChange={(e) => setForm((f) => ({ ...f, sigla: e.target.value.toUpperCase().slice(0, 12) }))}
                placeholder="Ex: LE"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>CNPJ</label>
              <Input
                className={inputClass}
                value={form.cnpj}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cnpj: formatCNPJ(e.target.value) }))
                }
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Telefone</label>
              <Input
                className={inputClass}
                value={form.telefone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }))
                }
                placeholder="(00) 0000-0000"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelClass}>Email</label>
              <Input
                className={inputClass}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="contato@lab.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Pessoa de contato</label>
              <Input
                className={inputClass}
                value={form.contato}
                onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                placeholder="Nome do responsável"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Integração (opcional)</label>
            <select
              className={`${inputClass} w-full px-3`}
              value={form.integrationId ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, integrationId: e.target.value || null }))}
            >
              <option value="">— Sem integração (manual) —</option>
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>{i.provider} · {i.mode}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              Vincule este lab a um provider configurado em <strong>Integrações de Apoio</strong> para envio/retorno automatizado.
            </p>
          </div>
        </div>
      </StandardDialog>

      {/* Vinculação de exames acontece SOMENTE no catálogo de Exames (hub canônico). */}

      {/* Dialog remover */}
      <StandardDialog
        open={!!removerAlvo}
        onClose={() => setRemoverAlvo(null)}
        title="Remover laboratório"
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setRemoverAlvo(null)}
              className="h-10 px-5 rounded-2xl border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarRemover}
              className="h-10 px-5 rounded-2xl bg-destructive text-destructive-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              Remover
            </button>
          </>
        }
      >
        <div className="px-6 py-5">
          <p className="text-sm text-muted-foreground">
            Deseja realmente remover{" "}
            <strong className="text-foreground">{removerAlvo?.nome}</strong>? Os exames
            atualmente vinculados a este laboratório serão movidos para análise{" "}
            <strong className="text-foreground">INTERNA</strong>.
          </p>
        </div>
      </StandardDialog>

      {/* Dialog mapeamento de exames (integration_exam_map) */}
      {mapeamentoOpen && (
        <MapeamentoExamesDialog
          open={!!mapeamentoOpen}
          onClose={() => setMapeamentoOpen(null)}
          labNome={mapeamentoOpen.nome}
          integrationId={mapeamentoOpen.integrationId ?? null}
        />
      )}
    </SectionShell>
  );
};

export default LabsApoioTab;
