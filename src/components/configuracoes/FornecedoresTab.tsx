/**
 * IA-FIRST OWNERSHIP HEADER
 * ─────────────────────────
 * Fornecedores = institutional registry of suppliers (catálogo).
 * Lives in /configuracoes (cadastros auxiliares), NOT in /estoque (operacional).
 * Consumed by: estoqueStore (Insumo.fornecedor_id, Lote.fornecedor_id).
 * This tab does NOT manage stock, lotes, or movements.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, searchNormalize } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import FornecedorDialog from "@/components/estoque/FornecedorDialog";
import { type Fornecedor, listarFornecedores, excluirFornecedor } from "@/data/estoqueStore";
import SectionShell from "./_shared/SectionShell";

export default function FornecedoresTab() {
  const [list, setList] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; fornecedor: Fornecedor | null }>({ open: false, fornecedor: null });
  const [confirm, setConfirm] = useState<Fornecedor | null>(null);

  async function carregar() {
    setLoading(true);
    setList(await listarFornecedores());
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = searchNormalize(busca);
    if (!q) return list;
    return list.filter((f) => searchNormalize(f.nome).includes(q) || searchNormalize((f.cnpj || "")).includes(q));
  }, [list, busca]);

  async function handleExcluir() {
    if (!confirm) return;
    const r = await excluirFornecedor(confirm.id);
    if (!r.ok) return toast.error(r.error ?? "Erro ao excluir");
    toast.success("Fornecedor excluído");
    setConfirm(null);
    carregar();
  }

  return (
    <SectionShell
      icon={<Building2 className="h-5 w-5" />}
      eyebrow="Cadastros auxiliares"
      title="Fornecedores"
      description="Cadastro de fornecedores usados em insumos e lotes do estoque."
      toolbar={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor..." className="pl-9 h-9 rounded-xl" />
          </div>
          <Button size="sm" onClick={() => setDialog({ open: true, fornecedor: null })}>
            <Plus className="w-4 h-4 mr-2" /> Novo fornecedor
          </Button>
        </div>
      }
    >

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-12 text-center">
          <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum fornecedor cadastrado</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold">CNPJ</th>
                  <th className="text-left px-4 py-3 font-semibold">Contato</th>
                  <th className="text-left px-4 py-3 font-semibold">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filtrados.map((f) => (
                  <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{f.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.cnpj || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.contato || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.telefone || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border", f.ativo ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground border-border")}>
                        {f.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDialog({ open: true, fornecedor: f })}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirm(f)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FornecedorDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, fornecedor: null })}
        fornecedor={dialog.fornecedor}
        onSaved={carregar}
      />

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{confirm?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}