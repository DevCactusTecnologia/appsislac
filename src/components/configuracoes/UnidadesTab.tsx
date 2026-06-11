import { useState, useEffect, useMemo } from "react";
import { searchNormalize } from "@/lib/utils";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  MapPin,
  Building2,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StandardDialog from "@/components/ui/standard-dialog";
import { toast } from "@/hooks/use-toast";
import StatusBadge from "@/components/StatusBadge";
import {
  getUnidades,
  addUnidade,
  updateUnidade,
  toggleUnidadeAtivo,
  deleteUnidade,
  getSedesEFiliais,
  getTipoLabel,
  subscribeUnidades,
  type Unidade,
  type TipoUnidade,
} from "@/data/unidadeStore";
import SectionShell from "./_shared/SectionShell";
import Toolbar from "./_shared/Toolbar";
import EmptyState from "./_shared/EmptyState";
import EstadoCidadeFields from "@/components/EstadoCidadeFields";

const tipoIcons: Record<TipoUnidade, React.ComponentType<{ className?: string }>> = {
  SEDE: Building2,
  FILIAL: Building,
  PONTO_DE_COLETA: MapPin,
};

const tipoBadge: Record<TipoUnidade, { label: string; type: "success" | "info" | "purple" }> = {
  SEDE: { label: "Sede", type: "success" },
  FILIAL: { label: "Filial", type: "info" },
  PONTO_DE_COLETA: { label: "Ponto de Coleta", type: "purple" },
};

const emptyForm = {
  nome: "",
  tipo: "" as TipoUnidade | "",
  endereco: "",
  cidade: "",
  estado: "",
  telefone: "",
  sedePaiId: "",
};


const inputClass =
  "w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all";
const selectClass = `${inputClass} appearance-none cursor-pointer pr-9`;
const labelClass =
  "text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block";

const UnidadesTab = () => {
  const [, forceUpdate] = useState(0);
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoUnidade | "TODOS">("TODOS");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => subscribeUnidades(() => forceUpdate((n) => n + 1)), []);

  const unidades = getUnidades();
  const sedesFiliais = getSedesEFiliais();

  const filtered = useMemo(() => {
    const q = searchNormalize(search);
    return unidades.filter(
      (u) =>
        (tipoFiltro === "TODOS" || u.tipo === tipoFiltro) &&
        (searchNormalize(u.nome).includes(q) ||
          searchNormalize(u.cidade).includes(q) ||
          searchNormalize(getTipoLabel(u.tipo)).includes(q))
    );
  }, [unidades, search, tipoFiltro]);

  const counts = useMemo(() => {
    return {
      TODOS: unidades.length,
      SEDE: unidades.filter((u) => u.tipo === "SEDE").length,
      FILIAL: unidades.filter((u) => u.tipo === "FILIAL").length,
      PONTO_DE_COLETA: unidades.filter((u) => u.tipo === "PONTO_DE_COLETA").length,
    };
  }, [unidades]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (u: Unidade) => {
    setEditingId(u.id);
    setForm({
      nome: u.nome,
      tipo: u.tipo,
      endereco: u.endereco,
      cidade: u.cidade,
      estado: u.estado,
      telefone: u.telefone,
      sedePaiId: u.sedePaiId || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "Informe o nome da unidade.",
        variant: "destructive",
      });
      return;
    }
    if (!form.tipo) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione o tipo da unidade.",
        variant: "destructive",
      });
      return;
    }
    if (form.tipo === "PONTO_DE_COLETA" && !form.sedePaiId) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione a sede/filial de referência.",
        variant: "destructive",
      });
      return;
    }

    if (editingId) {
      const ok = await updateUnidade(editingId, {
        nome: form.nome,
        tipo: form.tipo as TipoUnidade,
        endereco: form.endereco,
        cidade: form.cidade,
        estado: form.estado,
        telefone: form.telefone,
        sedePaiId: form.tipo === "PONTO_DE_COLETA" ? form.sedePaiId : undefined,
      });
      if (!ok) { toast({ title: "Falha ao atualizar unidade", variant: "destructive" }); return; }
      toast({ title: "Unidade atualizada", description: `"${form.nome}" foi salva com sucesso.` });
    } else {
      const created = await addUnidade({
        nome: form.nome,
        tipo: form.tipo as TipoUnidade,
        endereco: form.endereco,
        cidade: form.cidade,
        estado: form.estado,
        telefone: form.telefone,
        ativo: true,
        sedePaiId: form.tipo === "PONTO_DE_COLETA" ? form.sedePaiId : undefined,
      });
      if (!created) { toast({ title: "Falha ao cadastrar unidade", variant: "destructive" }); return; }
      toast({ title: "Unidade cadastrada", description: `"${form.nome}" foi criada com sucesso.` });
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const target = unidades.find((u) => u.id === deleteId);
    if (target?.padrao || target?.nome.toLowerCase() === "sede") {
      toast({
        title: "Não permitido",
        description: "A unidade 'Sede' é padrão do sistema e não pode ser removida.",
        variant: "destructive",
      });
      setDeleteId(null);
      return;
    }
    const ok = await deleteUnidade(deleteId);
    if (!ok) {
      toast({
        title: "Não permitido",
        description: "Esta unidade não pode ser removida.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Unidade removida" });
    }
    setDeleteId(null);
  };

  const deleteTarget = unidades.find((u) => u.id === deleteId);

  const tipoFiltros: { id: TipoUnidade | "TODOS"; label: string }[] = [
    { id: "TODOS", label: "Todas" },
    { id: "SEDE", label: "Sedes" },
    { id: "FILIAL", label: "Filiais" },
    { id: "PONTO_DE_COLETA", label: "Pontos" },
  ];

  return (
    <SectionShell
      icon={<MapPin className="h-5 w-5 text-primary" />}
      title="Unidades de Atendimento"
      description="Gerencie sedes, filiais e pontos de coleta"
      meta={
        <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
          {unidades.length} unidade{unidades.length !== 1 ? "s" : ""}
        </span>
      }
      actions={
        <Button className="rounded-xl text-xs h-9 gap-2" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          Nova unidade
        </Button>
      }
      toolbar={
        <Toolbar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nome, cidade ou tipo..."
          leading={tipoFiltros.map((f) => (
            <button
              key={f.id}
              onClick={() => setTipoFiltro(f.id)}
              className={`h-9 px-3 rounded-xl text-xs font-medium transition-all ${
                tipoFiltro === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}{" "}
              <span className="opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        />
      }
      bodyless
      footer={
        <div className="flex gap-3 items-start">
          <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5 shrink-0">
            <MapPin className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>
              <strong className="text-foreground">Sede:</strong> Unidade principal com acesso completo
              (atendimento, coleta, análise e resultados).
            </p>
            <p>
              <strong className="text-foreground">Filial:</strong> Unidade com mesmas capacidades da sede.
            </p>
            <p>
              <strong className="text-foreground">Ponto de Coleta:</strong> Apenas atendimento e coleta. As
              amostras são enviadas para a sede/filial de referência para análise e liberação de resultados.
            </p>
          </div>
        </div>
      }
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Nenhuma unidade encontrada"
          description={
            search || tipoFiltro !== "TODOS"
              ? "Tente ajustar a busca ou os filtros."
              : "Cadastre a primeira unidade para começar."
          }
        />
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((u) => {
            const Icon = tipoIcons[u.tipo];
            const badge = tipoBadge[u.tipo];
            const sedePai = u.sedePaiId
              ? unidades.find((s) => s.id === u.sedePaiId)
              : null;

            return (
              <div
                key={u.id}
                className="px-5 sm:px-6 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors"
              >
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    u.ativo ? "bg-primary/10" : "bg-muted"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      u.ativo ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={`text-sm font-semibold ${
                        u.ativo
                          ? "text-foreground"
                          : "text-muted-foreground line-through"
                      }`}
                    >
                      {u.nome}
                    </p>
                    <StatusBadge label={badge.label} type={badge.type} />
                    {u.padrao && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                        Padrão
                      </span>
                    )}
                    {!u.ativo && <StatusBadge label="Inativa" type="danger" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {u.cidade}
                    {u.estado && `/${u.estado}`} ·{" "}
                    {u.endereco || "Sem endereço"}
                  </p>
                  {sedePai && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      Envia amostras para:{" "}
                      <span className="font-medium text-foreground">
                        {sedePai.nome}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!u.padrao && (
                    <button
                      onClick={() => toggleUnidadeAtivo(u.id)}
                      className="p-2 rounded-lg hover:bg-accent transition-colors"
                      title={u.ativo ? "Desativar" : "Ativar"}
                    >
                      {u.ativo ? (
                        <ToggleRight className="h-4 w-4 text-primary" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(u)}
                    className="p-2 rounded-lg hover:bg-accent transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {!u.padrao && (
                    <button
                      onClick={() => setDeleteId(u.id)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form dialog */}
      <StandardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={<MapPin className="h-5 w-5 text-primary" />}
        title={editingId ? "Editar Unidade" : "Nova Unidade"}
        subtitle="Preencha os dados da unidade"
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
              onClick={handleSave}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelClass}>
              Nome da unidade <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Laboratório Central"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>
              Tipo <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <select
                value={form.tipo}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    tipo: e.target.value as TipoUnidade | "",
                    sedePaiId: "",
                  }))
                }
                className={selectClass}
              >
                <option value="">Selecione</option>
                <option value="SEDE">Sede</option>
                <option value="FILIAL">Filial</option>
                <option value="PONTO_DE_COLETA">Ponto de Coleta</option>
              </select>
              <ChevronIcon />
            </div>
          </div>

          {form.tipo === "PONTO_DE_COLETA" && (
            <div>
              <label className={labelClass}>
                Sede/Filial de referência <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <select
                  value={form.sedePaiId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, sedePaiId: e.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Selecione para onde enviar amostras</option>
                  {sedesFiliais.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({getTipoLabel(s.tipo)})
                    </option>
                  ))}
                </select>
                <ChevronIcon />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                As amostras coletadas neste ponto serão enviadas para esta unidade.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Endereço</label>
            <input
              type="text"
              value={form.endereco}
              onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))}
              placeholder="Rua, nº, Bairro"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <EstadoCidadeFields
              estado={form.estado}
              cidade={form.cidade}
              onChange={({ estado, cidade }) => setForm((p) => ({ ...p, estado, cidade }))}
              inputClassName={inputClass}
              labelClassName={labelClass}
              cidadeWrapperClassName="col-span-2"
            />
          </div>

          <div>
            <label className={labelClass}>Telefone</label>
            <input
              type="text"
              value={form.telefone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                let masked = digits;
                if (digits.length <= 10) {
                  // (00) 0000-0000
                  masked = digits
                    .replace(/^(\d{0,2})/, "($1")
                    .replace(/^\((\d{2})(\d)/, "($1) $2")
                    .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
                } else {
                  // (00) 00000-0000
                  masked = digits
                    .replace(/^(\d{0,2})/, "($1")
                    .replace(/^\((\d{2})(\d)/, "($1) $2")
                    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
                }
                setForm((p) => ({ ...p, telefone: masked }));
              }}
              placeholder="(00) 00000-0000"
              maxLength={15}
              inputMode="tel"
              className={inputClass}
            />
          </div>
        </div>
      </StandardDialog>

      {/* Delete dialog */}
      <StandardDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Remover unidade"
        maxWidth="sm"
        footer={
          <>
            <button
              onClick={() => setDeleteId(null)}
              className="h-10 px-5 rounded-2xl border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
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
            <strong className="text-foreground">{deleteTarget?.nome}</strong>? Esta ação
            não pode ser desfeita.
          </p>
        </div>
      </StandardDialog>
    </SectionShell>
  );
};

const ChevronIcon = () => (
  <svg
    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default UnidadesTab;
