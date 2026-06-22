import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Plus, Pencil, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  listarMateriaisAmostra,
  criarMaterialAmostra,
  atualizarMaterialAmostra,
  removerMaterialAmostra,
  type MaterialAmostra,
} from "@/data/materiaisAmostraStore";
import { toast } from "@/hooks/use-toast";
import { SorotecaShell } from "@/components/soroteca/SorotecaShell";

interface FormState {
  nome: string;
  sigla: string;
  diasRetencao: string;
  horasValidade: string;
  temperaturaRecomendada: string;
  reutilizavel: boolean;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: "",
  sigla: "",
  diasRetencao: "0",
  horasValidade: "0",
  temperaturaRecomendada: "",
  reutilizavel: false,
  ativo: true,
};

export default function SorotecaMateriais() {
  const [rows, setRows] = useState<MaterialAmostra[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialAmostra | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [confirmRemove, setConfirmRemove] = useState<MaterialAmostra | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total]);

  async function load() {
    setLoading(true);
    const res = await listarMateriaisAmostra({ search: debounced, page, pageSize });
    setRows(res.rows);
    setTotal(res.total);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, page]);

  useEffect(() => { setPage(1); }, [debounced]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(m: MaterialAmostra) {
    setEditing(m);
    setForm({
      nome: m.nome,
      sigla: m.sigla,
      diasRetencao: String(m.diasRetencao),
      horasValidade: String(m.horasValidade),
      temperaturaRecomendada: m.temperaturaRecomendada,
      reutilizavel: m.reutilizavel,
      ativo: m.ativo,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome,
      sigla: form.sigla,
      diasRetencao: Number(form.diasRetencao || 0),
      horasValidade: Number(form.horasValidade || 0),
      temperaturaRecomendada: form.temperaturaRecomendada,
      reutilizavel: form.reutilizavel,
      ativo: form.ativo,
    };
    const ok = editing
      ? await atualizarMaterialAmostra(editing.id, payload)
      : !!(await criarMaterialAmostra(payload));
    setSaving(false);
    if (ok) {
      toast({ title: editing ? "Material atualizado" : "Material criado" });
      setDialogOpen(false);
      await load();
    }
  }

  async function handleRemove() {
    if (!confirmRemove) return;
    const ok = await removerMaterialAmostra(confirmRemove.id);
    if (ok) {
      toast({ title: "Material removido" });
      setConfirmRemove(null);
      await load();
    }
  }

  return (
    <SorotecaShell
      title="Materiais"
      description="Catálogo único usado por Coleta, Atendimento, Produção e Resultados."
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Novo material
        </Button>
      }
    >
      <Helmet>
        <title>Materiais — Soroteca | SISLAC</title>
        <meta name="description" content="Catálogo canônico de materiais laboratoriais da Soroteca." />
      </Helmet>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou sigla…"
          className="pl-9"
        />
      </div>


      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Sigla</th>
                <th className="px-4 py-3 font-medium">Retenção (dias)</th>
                <th className="px-4 py-3 font-medium">Validade (h)</th>
                <th className="px-4 py-3 font-medium">Temperatura</th>
                <th className="px-4 py-3 font-medium">Reutilizável</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando…
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum material encontrado.
                </td></tr>
              ) : rows.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{m.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.sigla || "—"}</td>
                  <td className="px-4 py-3">{m.diasRetencao}</td>
                  <td className="px-4 py-3">{m.horasValidade}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.temperaturaRecomendada || "—"}</td>
                  <td className="px-4 py-3">{m.reutilizavel ? "Sim" : "Não"}</td>
                  <td className="px-4 py-3">
                    <Badge variant={m.ativo ? "default" : "secondary"} className="h-6">
                      {m.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(m)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setConfirmRemove(m)} aria-label="Remover">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages} • {total} {total === 1 ? "material" : "materiais"}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar material" : "Novo material"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Soro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="sigla">Sigla</Label>
                <Input id="sigla" value={form.sigla} onChange={(e) => setForm({ ...form, sigla: e.target.value.toUpperCase() })} maxLength={8} placeholder="SOR" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="temp">Temperatura</Label>
                <Input id="temp" value={form.temperaturaRecomendada} onChange={(e) => setForm({ ...form, temperaturaRecomendada: e.target.value })} placeholder="2-8°C" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="retencao">Dias de retenção</Label>
                <Input id="retencao" type="number" min={0} value={form.diasRetencao} onChange={(e) => setForm({ ...form, diasRetencao: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="validade">Horas de validade</Label>
                <Input id="validade" type="number" min={0} value={form.horasValidade} onChange={(e) => setForm({ ...form, horasValidade: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Reutilizável</p>
                <p className="text-xs text-muted-foreground">Permite múltiplas alíquotas.</p>
              </div>
              <Switch checked={form.reutilizavel} onCheckedChange={(v) => setForm({ ...form, reutilizavel: v })} />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Aparece nos formulários de seleção.</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover material?</AlertDialogTitle>
            <AlertDialogDescription>
              O material <strong>{confirmRemove?.nome}</strong> será removido do catálogo.
              Amostras existentes continuarão preservadas (vínculo é apenas desfeito).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SorotecaShell>
  );

}
