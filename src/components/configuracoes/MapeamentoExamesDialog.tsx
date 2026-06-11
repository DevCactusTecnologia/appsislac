// Diálogo de Mapeamento de Exames (integration_exam_map) por Lab de Apoio.
// Multi-tenant: tenant_id resolvido server-side via RLS.
// CRUD inline + busca com debounce. Aditivo, não altera fluxos existentes.

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Search, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/data/_tenant";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface MapRow {
  id: string;
  exame_sislac_id: string;
  exame_apoio_codigo: string;
  exame_apoio_nome: string | null;
  material: string | null;
  ativo: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  labNome: string;
  /** Integration ID vinculada ao lab. Se null, não há provider configurado. */
  integrationId: string | null;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const MapeamentoExamesDialog = ({ open, onClose, labNome, integrationId }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<MapRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<MapRow>>({});

  const catalogo = useMemo(() => getExamesCatalogo(), []);
  const catalogoMap = useMemo(() => new Map(catalogo.map(e => [e.id, e])), [catalogo]);

  useEffect(() => {
    if (!open || !integrationId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("integration_exam_map")
        .select("id, exame_sislac_id, exame_apoio_codigo, exame_apoio_nome, material, ativo")
        .eq("integration_id", integrationId)
        .order("exame_apoio_codigo");
      if (!cancel) {
        if (error) toast({ title: "Falha ao carregar mapeamentos", variant: "destructive" });
        setRows((data as MapRow[] | null) ?? []);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, integrationId, toast]);

  const filtered = useMemo(() => {
    const q = norm(debounced.trim());
    if (!q) return rows;
    return rows.filter(r => {
      const ex = catalogoMap.get(r.exame_sislac_id);
      return (
        norm(r.exame_apoio_codigo).includes(q) ||
        norm(r.exame_apoio_nome ?? "").includes(q) ||
        norm(ex?.nome ?? "").includes(q) ||
        norm(ex?.mnemonico ?? "").includes(q)
      );
    });
  }, [rows, debounced, catalogoMap]);

  const startNew = () => {
    setEditingId("__new__");
    setDraft({ exame_sislac_id: "", exame_apoio_codigo: "", exame_apoio_nome: "", material: "", ativo: true });
  };

  const startEdit = (r: MapRow) => {
    setEditingId(r.id);
    setDraft({ ...r });
  };

  const cancelEdit = () => { setEditingId(null); setDraft({}); };

  const save = async () => {
    if (!integrationId) return;
    if (!draft.exame_sislac_id || !draft.exame_apoio_codigo?.trim()) {
      toast({ title: "Selecione o exame SISLAC e informe o código do apoio", variant: "destructive" });
      return;
    }
    try {
      if (editingId === "__new__") {
        const tenant_id = await getCurrentTenantId();
        const { data, error } = await supabase.from("integration_exam_map").insert({
          tenant_id,
          integration_id: integrationId,
          exame_sislac_id: draft.exame_sislac_id,
          exame_apoio_codigo: draft.exame_apoio_codigo!.trim(),
          exame_apoio_nome: draft.exame_apoio_nome?.trim() || null,
          material: draft.material?.trim() || null,
          ativo: draft.ativo ?? true,
        } as never).select("id, exame_sislac_id, exame_apoio_codigo, exame_apoio_nome, material, ativo").single();
        if (error) throw error;
        setRows(prev => [...prev, data as MapRow]);
        toast({ title: "Mapeamento criado" });
      } else if (editingId) {
        const { error } = await supabase.from("integration_exam_map").update({
          exame_sislac_id: draft.exame_sislac_id,
          exame_apoio_codigo: draft.exame_apoio_codigo!.trim(),
          exame_apoio_nome: draft.exame_apoio_nome?.trim() || null,
          material: draft.material?.trim() || null,
          ativo: draft.ativo ?? true,
        }).eq("id", editingId);
        if (error) throw error;
        setRows(prev => prev.map(r => r.id === editingId ? { ...r, ...draft } as MapRow : r));
        toast({ title: "Mapeamento atualizado" });
      }
      cancelEdit();
    } catch (e) {
      toast({ title: "Erro ao salvar", description: String((e as Error).message), variant: "destructive" });
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("integration_exam_map").delete().eq("id", id);
    if (error) {
      toast({ title: "Falha ao remover", variant: "destructive" });
      return;
    }
    setRows(prev => prev.filter(r => r.id !== id));
    toast({ title: "Mapeamento removido" });
  };

  const isEditing = editingId !== null;

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<Link2 className="h-5 w-5 text-primary" />}
      title="Mapeamento de exames"
      subtitle={`${labNome} · vincule exames SISLAC aos códigos do laboratório de apoio`}
      maxWidth="xl"
      footer={
        <button
          onClick={onClose}
          className="h-10 px-5 rounded-2xl border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
        >
          Fechar
        </button>
      }
    >
      <div className="px-6 py-5 space-y-4">
        {!integrationId ? (
          <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl p-4 border border-border/60">
            Este laboratório ainda não possui uma <strong className="text-foreground">integração</strong> vinculada.
            Edite o cadastro do laboratório e selecione uma integração configurada em
            <strong className="text-foreground"> Configurações → Integrações de Apoio</strong>.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por código apoio, nome, exame SISLAC..."
                  className="pl-9 h-9 rounded-lg text-sm"
                />
              </div>
              <button
                onClick={startNew}
                disabled={isEditing}
                className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo mapeamento
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Exame SISLAC</th>
                    <th className="text-left px-3 py-2 font-semibold">Código apoio</th>
                    <th className="text-left px-3 py-2 font-semibold">Nome no apoio</th>
                    <th className="text-left px-3 py-2 font-semibold">Material</th>
                    <th className="text-center px-3 py-2 font-semibold">Ativo</th>
                    <th className="text-right px-3 py-2 font-semibold w-[110px]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {editingId === "__new__" && (
                    <RowEditor draft={draft} setDraft={setDraft} catalogo={catalogo} onSave={save} onCancel={cancelEdit} />
                  )}
                  {loading ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Carregando...
                    </td></tr>
                  ) : filtered.length === 0 && editingId !== "__new__" ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground italic">
                      Nenhum mapeamento {search ? "para a busca atual" : "cadastrado"}
                    </td></tr>
                  ) : (
                    filtered.map((r) => {
                      const ex = catalogoMap.get(r.exame_sislac_id);
                      const editingThis = editingId === r.id;
                      if (editingThis) {
                        return <RowEditor key={r.id} draft={draft} setDraft={setDraft} catalogo={catalogo} onSave={save} onCancel={cancelEdit} />;
                      }
                      return (
                        <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-3 py-2">
                            {ex ? (
                              <div>
                                <div className="font-mono text-[10px] text-primary">{ex.mnemonico}</div>
                                <div className="text-foreground">{ex.nome}</div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic">Exame removido</span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-mono text-foreground">{r.exame_apoio_codigo}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.exame_apoio_nome || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.material || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${r.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                              {r.ativo ? "Sim" : "Não"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="inline-flex gap-1">
                              <button onClick={() => startEdit(r)} disabled={isEditing}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50" title="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => remove(r.id)} disabled={isEditing}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-50" title="Remover">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {rows.length} mapeamento{rows.length !== 1 ? "s" : ""} · usado pela integração ao enviar pedidos e importar resultados.
            </p>
          </>
        )}
      </div>
    </StandardDialog>
  );
};

function RowEditor({
  draft, setDraft, catalogo, onSave, onCancel,
}: {
  draft: Partial<MapRow>;
  setDraft: (d: Partial<MapRow>) => void;
  catalogo: ReturnType<typeof getExamesCatalogo>;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="border-t border-border bg-primary/5">
      <td className="px-2 py-2">
        <select
          className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={draft.exame_sislac_id ?? ""}
          onChange={(e) => setDraft({ ...draft, exame_sislac_id: e.target.value })}
        >
          <option value="">— Selecione —</option>
          {catalogo.map(ex => (
            <option key={ex.id} value={ex.id}>{ex.mnemonico} · {ex.nome}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <Input className="h-8 text-xs" value={draft.exame_apoio_codigo ?? ""} placeholder="Ex: 1234"
          onChange={(e) => setDraft({ ...draft, exame_apoio_codigo: e.target.value })} />
      </td>
      <td className="px-2 py-2">
        <Input className="h-8 text-xs" value={draft.exame_apoio_nome ?? ""} placeholder="Nome no apoio (opcional)"
          onChange={(e) => setDraft({ ...draft, exame_apoio_nome: e.target.value })} />
      </td>
      <td className="px-2 py-2">
        <Input className="h-8 text-xs" value={draft.material ?? ""} placeholder="Soro, sangue..."
          onChange={(e) => setDraft({ ...draft, material: e.target.value })} />
      </td>
      <td className="px-2 py-2 text-center">
        <input type="checkbox" checked={draft.ativo ?? true}
          onChange={(e) => setDraft({ ...draft, ativo: e.target.checked })}
          className="h-4 w-4 accent-primary" />
      </td>
      <td className="px-2 py-2 text-right">
        <div className="inline-flex gap-1">
          <button onClick={onSave} className="p-1.5 rounded-lg bg-primary text-primary-foreground" title="Salvar">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground" title="Cancelar">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default MapeamentoExamesDialog;