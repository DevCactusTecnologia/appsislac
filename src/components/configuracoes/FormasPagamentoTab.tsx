import { useEffect, useState } from "react";
import { Plus, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { persistOrThrow } from "@/lib/persist";
import { showError } from "@/lib/showError";
import {
  createItem,
  reloadAll,
  type ListaItem,
} from "@/data/financeiroListasStore";

type Forma = ListaItem;

async function loadAllFormas(): Promise<Forma[]> {
  const { data, error } = await supabase
    .from("financeiro_formas_pagamento")
    .select("id, nome, sistema, ativo, ordem")
    .order("ordem", { ascending: true })
    .order("nome", { ascending: true });
  if (error) {
    showError(error, { scope: "formasPagamento.loadAll", userMessage: "Não foi possível carregar as formas de pagamento." });
    return [];
  }
  return (data ?? []).map((r) => ({ id: r.id, nome: r.nome, sistema: r.sistema, ativo: r.ativo, ordem: r.ordem }));
}

export default function FormasPagamentoTab() {
  const [items, setItems] = useState<Forma[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function carregar() {
    setLoading(true);
    const list = await loadAllFormas();
    setItems(list);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const nome = novoNome.trim();
    if (!nome) return;
    setCreating(true);
    try {
      await createItem("forma_pagamento", nome);
      setNovoNome("");
      toast.success("Forma de pagamento adicionada");
      await carregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível adicionar");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(item: Forma, ativo: boolean) {
    setTogglingId(item.id);
    // Optimistic
    setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, ativo } : x));
    try {
      await persistOrThrow(
        supabase.from("financeiro_formas_pagamento").update({ ativo }).eq("id", item.id),
        "formasPagamento.toggle",
      );
      await reloadAll();
      toast.success(ativo ? "Forma ativada" : "Forma desativada");
    } catch (err) {
      setItems((prev) => prev.map((x) => x.id === item.id ? { ...x, ativo: !ativo } : x));
      showError(err, { scope: "formasPagamento.toggle", userMessage: "Não foi possível atualizar." });
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Formas de Pagamento</h2>
            <p className="text-xs text-muted-foreground">
              Ative, desative ou cadastre novas formas usadas em entradas e saídas do financeiro.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreate} className="flex gap-2 mb-6">
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Ex.: PIX, Dinheiro, Crédito..."
            maxLength={60}
            className="h-10"
          />
          <Button type="submit" disabled={creating || !novoNome.trim()} className="h-10 gap-2 shrink-0">
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </form>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma forma de pagamento cadastrada.
          </div>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-xl overflow-hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${item.ativo ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {item.nome}
                    </p>
                    {item.sistema && (
                      <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wide">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {item.ativo ? "Disponível para uso" : "Desativada"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={item.ativo}
                    disabled={togglingId === item.id || item.sistema}
                    onCheckedChange={(v) => handleToggle(item, v)}
                    aria-label={`Ativar ${item.nome}`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}