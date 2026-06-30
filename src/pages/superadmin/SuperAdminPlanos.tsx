// /super-admin/planos — Catálogo de planos de assinatura (Stripe-like).

import { useEffect, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageSkeleton } from "@/components/superadmin/PageHeader";
import { PlanCard, type SubscriptionPlan } from "@/components/superadmin/PlanCard";

const emptyPlan = (): Partial<SubscriptionPlan> & { features: string[] } => ({
  code: "",
  nome: "",
  descricao: "",
  preco_mensal_cents: 0,
  preco_anual_cents: null,
  moeda: "BRL",
  limite_atendimentos_mes: null,
  limite_usuarios: null,
  limite_unidades: null,
  features: [],
  is_active: true,
  is_public: true,
  is_default: false,
  sort_order: 0,
});

export default function SuperAdminPlanos() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Partial<SubscriptionPlan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [featureInput, setFeatureInput] = useState("");

  const load = async () => {
    if (plans.length === 0) setLoading(true); else setRefreshing(true);
    const { data, error } = await supabase.functions.invoke("super-admin-plans", { body: { action: "list" } });
    setLoading(false);
    setRefreshing(false);
    if (error) { toast.error(error.message); return; }
    setPlans((data?.plans ?? []) as SubscriptionPlan[]);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(emptyPlan()); setFeatureInput(""); };
  const openEdit = (p: SubscriptionPlan) => { setEditing({ ...p, features: [...p.features] }); setFeatureInput(""); };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await supabase.functions.invoke("super-admin-plans", {
      body: { action: "upsert", plan: editing },
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano salvo");
    setEditing(null);
    void load();
  };

  const toggleActive = async (p: SubscriptionPlan) => {
    const { error } = await supabase.functions.invoke("super-admin-plans", {
      body: { action: "toggleActive", code: p.code, value: !p.is_active },
    });
    if (error) { toast.error(error.message); return; }
    void load();
  };

  const setDefault = async (p: SubscriptionPlan) => {
    const { error } = await supabase.functions.invoke("super-admin-plans", {
      body: { action: "setDefault", code: p.code },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`${p.nome} agora é o plano padrão`);
    void load();
  };

  const remove = async () => {
    if (!deleteCode) return;
    const { error } = await supabase.functions.invoke("super-admin-plans", {
      body: { action: "delete", code: deleteCode },
    });
    setDeleteCode(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Plano excluído");
    void load();
  };

  const addFeature = () => {
    const v = featureInput.trim();
    if (!v || !editing) return;
    setEditing({ ...editing, features: [...(editing.features ?? []), v] });
    setFeatureInput("");
  };
  const removeFeature = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, features: (editing.features ?? []).filter((_, i) => i !== idx) });
  };

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Subscription"
        title="Planos & Preços"
        description="Catálogo de planos comerciais disponíveis para os laboratórios."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" /> Novo plano
            </Button>
          </>
        }
      />

      {loading ? (
        <PageSkeleton rows={3} />
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">Nenhum plano cadastrado ainda.</p>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1.5" /> Criar primeiro plano</Button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              highlight={p.is_default}
              onEdit={() => openEdit(p)}
              onToggleActive={() => toggleActive(p)}
              onSetDefault={() => setDefault(p)}
              onDelete={() => setDeleteCode(p.code)}
            />
          ))}
        </div>
      )}

      {/* Dialog de edição/criação — padrão flat tenant */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-[720px] max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-base font-bold tracking-tight">
                  {editing?.id ? "Editar plano" : "Novo plano"}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Configure preço, limites de uso e benefícios. Valores em reais (R$).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {editing && (
            <div className="px-6 py-5 space-y-6">
              {/* Identificação */}
              <Section title="Identificação" hint="Como o plano aparece para os laboratórios.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Nome do plano" htmlFor="p-nome" required>
                    <Input id="p-nome" value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex: Profissional" />
                  </Field>
                  <Field label="Código (slug)" htmlFor="p-code" hint="auto a partir do nome se vazio">
                    <Input id="p-code" value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} disabled={!!editing.id} className="font-mono" placeholder="profissional" />
                  </Field>
                </div>
                <Field label="Descrição" htmlFor="p-desc" hint="resumo curto exibido no card">
                  <Textarea id="p-desc" rows={2} value={editing.descricao ?? ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} placeholder="Para clínicas que precisam de mais volume e equipe maior." />
                </Field>
              </Section>

              {/* Preço */}
              <Section title="Preço" hint="Mensal obrigatório, anual opcional (desconto).">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Mensal" htmlFor="p-pm" required>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">R$</span>
                      <Input
                        id="p-pm" type="number" min={0} step="0.01" className="pl-9"
                        value={((editing.preco_mensal_cents ?? 0) / 100).toString()}
                        onChange={(e) => setEditing({ ...editing, preco_mensal_cents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
                      />
                    </div>
                  </Field>
                  <Field label="Anual" htmlFor="p-pa" hint="opcional">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">R$</span>
                      <Input
                        id="p-pa" type="number" min={0} step="0.01" className="pl-9"
                        value={editing.preco_anual_cents == null ? "" : (editing.preco_anual_cents / 100).toString()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setEditing({ ...editing, preco_anual_cents: v === "" ? null : Math.round((parseFloat(v) || 0) * 100) });
                        }}
                      />
                    </div>
                  </Field>
                </div>
              </Section>

              {/* Limites */}
              <Section title="Limites de uso" hint="Deixe em branco para tornar ilimitado.">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Atend./mês" htmlFor="p-la">
                    <Input id="p-la" type="number" min={0}
                      value={editing.limite_atendimentos_mes ?? ""}
                      onChange={(e) => setEditing({ ...editing, limite_atendimentos_mes: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="∞"
                    />
                  </Field>
                  <Field label="Usuários" htmlFor="p-lu">
                    <Input id="p-lu" type="number" min={0}
                      value={editing.limite_usuarios ?? ""}
                      onChange={(e) => setEditing({ ...editing, limite_usuarios: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="∞"
                    />
                  </Field>
                  <Field label="Unidades" htmlFor="p-ln">
                    <Input id="p-ln" type="number" min={0}
                      value={editing.limite_unidades ?? ""}
                      onChange={(e) => setEditing({ ...editing, limite_unidades: e.target.value === "" ? null : Number(e.target.value) })}
                      placeholder="∞"
                    />
                  </Field>
                </div>
              </Section>

              {/* Benefícios */}
              <Section title="Benefícios" hint="Lista de features destacadas no card do plano.">
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: Suporte prioritário 24/7"
                      value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(); } }}
                    />
                    <Button type="button" variant="outline" onClick={addFeature} className="shrink-0">
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {(editing.features ?? []).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {(editing.features ?? []).map((f, i) => (
                        <span key={i} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary/5 border border-primary/20 text-foreground text-xs">
                          {f}
                          <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Nenhum benefício adicionado.</p>
                  )}
                </div>
              </Section>

              {/* Visibilidade */}
              <Section title="Visibilidade & Status">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ToggleRow label="Ativo" checked={!!editing.is_active} onChange={(v) => setEditing({ ...editing, is_active: v })} hint="aceita assinaturas" />
                  <ToggleRow label="Público" checked={!!editing.is_public} onChange={(v) => setEditing({ ...editing, is_public: v })} hint="aparece na vitrine" />
                  <ToggleRow label="Padrão" checked={!!editing.is_default} onChange={(v) => setEditing({ ...editing, is_default: v })} hint="novos labs" />
                </div>
              </Section>
            </div>
          )}
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !editing?.nome}>
              {saving ? "Salvando..." : (editing?.id ? "Salvar alterações" : "Criar plano")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={deleteCode !== null} onOpenChange={(o) => !o && setDeleteCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Só é possível excluir planos que não estão sendo usados por nenhum laboratório.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, hint, htmlFor, required, children }: { label: string; hint?: string; htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-[11px] font-semibold text-foreground uppercase tracking-wider flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
        {hint && <span className="ml-1 text-[10px] text-muted-foreground font-normal normal-case tracking-normal">({hint})</span>}
      </Label>
      {children}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between border-b border-border/60 pb-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h4>
        {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}


function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 h-10">
      <div>
        <div className="text-xs font-medium text-foreground">{label}</div>
        {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}