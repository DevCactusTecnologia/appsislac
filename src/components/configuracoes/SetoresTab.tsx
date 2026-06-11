import React, { useEffect, useMemo, useState } from "react";
import { searchNormalize } from "@/lib/utils";
import { Tags, Plus, Pencil, Trash2, Power, Lock, Check, X, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import SectionShell from "./_shared/SectionShell";
import Toolbar from "./_shared/Toolbar";
import EmptyState from "./_shared/EmptyState";
import { SETORES_LABORATORIAIS } from "@/lib/laboratorioPadroes";
import {
  loadSetoresCustomizados,
  subscribeSetoresCustomizados,
  getSetoresCustomizados,
  isSetoresLoaded,
  addSetorCustomizado,
  renameSetorCustomizado,
  toggleSetorCustomizado,
  removeSetorCustomizado,
  isSetorPadrao,
  type SetorCustomizado,
} from "@/data/setoresLaboratoriaisStore";
import { getCurrentTenantId } from "@/data/_tenant";

type StatusFilter = "todos" | "ativos" | "inativos";

interface RowItem {
  id: string;          // "padrao:NOME" ou uuid
  nome: string;
  ativo: boolean;
  padrao: boolean;
}

const SetoresTab = () => {
  const [, force] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNome, setEditingNome] = useState("");

  const [deleteConfirm, setDeleteConfirm] = useState<RowItem | null>(null);

  // Inicializa store
  useEffect(() => {
    if (!isSetoresLoaded()) {
      loadSetoresCustomizados();
    }
    const unsub = subscribeSetoresCustomizados(() => force((n) => n + 1));
    return () => {
      unsub();
    };
  }, []);

  const customizados = getSetoresCustomizados();

  // Constrói lista combinada (padrão SBPC/ML + customizados do tenant).
  // Regra: TODO setor cujo nome conste em SETORES_LABORATORIAIS é padrão
  // imutável, mesmo que exista um registro com o mesmo nome no banco
  // (registros materializados servem apenas para preservar o vínculo
  // setor_id dos exames; jamais aparecem como "Customizado" na UI).
  const rows: RowItem[] = useMemo(() => {
    const padraoUpper = new Set(
      (SETORES_LABORATORIAIS as readonly string[]).map((n) => n.trim().toUpperCase()),
    );

    const padrao: RowItem[] = (SETORES_LABORATORIAIS as readonly string[]).map((n) => ({
      id: `padrao:${n}`,
      nome: n,
      ativo: true,
      padrao: true,
    }));

    // Customizados reais = apenas registros do banco com nome FORA da lista padrão
    const custom: RowItem[] = customizados
      .filter((s) => !padraoUpper.has(s.nome.trim().toUpperCase()))
      .map((s) => ({
        id: s.id,
        nome: s.nome,
        ativo: s.ativo,
        padrao: false,
      }));

    return [...padrao, ...custom].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [customizados]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter === "ativos") list = list.filter((r) => r.ativo);
    if (statusFilter === "inativos") list = list.filter((r) => !r.ativo);
    if (!search.trim()) return list;
    const term = searchNormalize(search);
    return list.filter((r) =>
      r.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(term),
    );
  }, [rows, search, statusFilter]);

  const padraoUpperSet = useMemo(
    () => new Set((SETORES_LABORATORIAIS as readonly string[]).map((n) => n.trim().toUpperCase())),
    [],
  );
  const padraoCount = (SETORES_LABORATORIAIS as readonly string[]).length;
  const customCount = customizados.filter(
    (s) => !padraoUpperSet.has(s.nome.trim().toUpperCase()),
  ).length;
  const ativosCount = rows.filter((r) => r.ativo).length;

  const handleAdd = async () => {
    const clean = novoNome.trim().toUpperCase();
    if (!clean) {
      toast({ title: "Nome obrigatório", description: "Informe um nome para o setor.", variant: "destructive" });
      return;
    }
    if (isSetorPadrao(clean)) {
      toast({
        title: "Setor já existe",
        description: "Este nome já consta nos setores padrão SBPC/ML.",
        variant: "destructive",
      });
      return;
    }
    if (customizados.some((s) => s.nome.toUpperCase() === clean)) {
      toast({ title: "Setor duplicado", description: "Já existe um setor customizado com esse nome.", variant: "destructive" });
      return;
    }
    const tenantId = await getCurrentTenantId();
    const created = await addSetorCustomizado(clean, tenantId);
    if (created) {
      toast({ title: "Setor criado", description: `"${clean}" adicionado com sucesso.` });
      setNovoNome("");
      setNovoOpen(false);
    } else {
      toast({ title: "Falha ao criar", description: "Tente novamente.", variant: "destructive" });
    }
  };

  const beginEdit = (row: RowItem) => {
    if (row.padrao) return;
    setEditingId(row.id);
    setEditingNome(row.nome);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingNome("");
  };

  const saveEdit = async (row: RowItem) => {
    const clean = editingNome.trim().toUpperCase();
    if (!clean || clean === row.nome) {
      cancelEdit();
      return;
    }
    const ok = await renameSetorCustomizado(row.id, clean);
    if (ok) {
      toast({ title: "Setor renomeado", description: `Agora chamado "${clean}".` });
      cancelEdit();
    } else {
      toast({
        title: "Não foi possível renomear",
        description: "O nome pode já estar em uso ou conflitar com um setor padrão.",
        variant: "destructive",
      });
    }
  };

  const handleToggle = async (row: RowItem) => {
    if (row.padrao) return;
    const ok = await toggleSetorCustomizado(row.id);
    if (ok) {
      toast({
        title: row.ativo ? "Setor desativado" : "Setor ativado",
        description: `"${row.nome}" foi ${row.ativo ? "desativado" : "ativado"}.`,
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm || deleteConfirm.padrao) return;
    const ok = await removeSetorCustomizado(deleteConfirm.id);
    if (ok) {
      toast({ title: "Setor excluído", description: `"${deleteConfirm.nome}" removido.` });
    }
    setDeleteConfirm(null);
  };

  const StatusChip = ({ value, label, count }: { value: StatusFilter; label: string; count: number }) => {
    const active = statusFilter === value;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(value)}
        className={`h-9 px-3 rounded-xl border text-[12px] font-medium transition-all duration-200 inline-flex items-center gap-1.5 ${
          active
            ? "bg-primary/10 text-primary border-primary/30"
            : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        {label}
        <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${active ? "bg-background/60" : "bg-muted/60"}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <React.Fragment>
      <SectionShell
        icon={<Tags className="h-5 w-5 text-primary" />}
        title="Setores laboratoriais"
        description="Gerencie os setores usados na classificação de exames (padrão SBPC/ML + customizados do laboratório)"
        meta={
          <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
            {padraoCount} padrão · {customCount} customizado{customCount === 1 ? "" : "s"}
          </span>
        }
        actions={
          <Button className="rounded-xl text-xs h-9 gap-2" onClick={() => setNovoOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Novo setor
          </Button>
        }
        toolbar={
          <div className="space-y-3">
            <Toolbar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Buscar setor..."
            />
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip value="todos" label="Todos" count={rows.length} />
              <StatusChip value="ativos" label="Ativos" count={ativosCount} />
              <StatusChip value="inativos" label="Inativos" count={rows.length - ativosCount} />
              <span className="ml-auto hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="h-3 w-3" /> Setores padrão SBPC/ML são imutáveis
              </span>
            </div>
          </div>
        }
        bodyless
      >
        <div className="px-5 sm:px-6 py-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Tags}
              title="Nenhum setor encontrado"
              description={
                search || statusFilter !== "todos"
                  ? "Ajuste a busca ou filtros."
                  : "Adicione um setor customizado para começar."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 text-left">
                    <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Nome</th>
                    <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[140px]">Origem</th>
                    <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[110px]">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[160px] text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => {
                    const isEditing = editingId === row.id;
                    return (
                      <tr key={row.id} className={`border-t border-border/30 hover:bg-muted/20 transition-colors ${!row.ativo ? "opacity-60" : ""}`}>
                        <td className="py-3 px-4">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editingNome}
                              onChange={(e) => setEditingNome(e.target.value.toUpperCase())}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(row);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="h-9 w-full max-w-md px-3 rounded-lg border border-primary/40 bg-background text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          ) : (
                            <span className="font-semibold text-foreground tracking-tight">{row.nome}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {row.padrao ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-accent text-accent-foreground uppercase tracking-wider">
                              <Lock className="h-2.5 w-2.5" /> SBPC/ML
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-primary/10 text-primary uppercase tracking-wider">
                              Customizado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg ${
                              row.ativo
                                ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {row.ativo ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {row.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-0.5">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(row)}
                                  className="p-1.5 rounded-lg hover:bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))] transition-colors"
                                  title="Salvar"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                                  title="Cancelar"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : row.padrao ? (
                              <span className="text-[11px] text-muted-foreground italic px-2">Imutável</span>
                            ) : (
                              <>
                                <button
                                  onClick={() => beginEdit(row)}
                                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                  title="Renomear"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleToggle(row)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    row.ativo
                                      ? "hover:bg-warning/10 text-muted-foreground hover:text-warning"
                                      : "hover:bg-[hsl(var(--status-success))]/10 text-muted-foreground hover:text-[hsl(var(--status-success))]"
                                  }`}
                                  title={row.ativo ? "Desativar" : "Ativar"}
                                >
                                  <Power className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(row)}
                                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionShell>

      {/* Dialog: novo setor */}
      <Dialog open={novoOpen} onOpenChange={(v) => { if (!v) { setNovoOpen(false); setNovoNome(""); } }}>
        <DialogContent className="max-w-md rounded-3xl border-border/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-primary/10">
                <Tags className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">Novo setor laboratorial</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground mb-4">
              Adicione um setor customizado ao laboratório. Ele ficará disponível no cadastro de exames.
            </DialogDescription>
            <input
              autoFocus
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Ex.: BIOLOGIA MOLECULAR ESPECIAL"
              className="h-11 w-full px-4 rounded-2xl border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <button
              onClick={() => { setNovoOpen(false); setNovoNome(""); }}
              className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all duration-200 shadow-sm"
            >
              Adicionar setor
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: confirmar exclusão */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-2xl flex items-center justify-center bg-destructive/8">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">Excluir setor</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir o setor "{deleteConfirm?.nome}"? Exames já vinculados manterão o nome registrado, mas o setor não estará mais disponível para novos cadastros.
            </DialogDescription>
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              className="h-11 px-6 rounded-2xl bg-destructive text-destructive-foreground text-[13px] font-semibold hover:opacity-90 transition-all duration-200 shadow-sm"
            >
              Excluir setor
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};

export default SetoresTab;
