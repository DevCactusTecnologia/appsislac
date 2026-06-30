// Lista de Laboratórios (Tenants) — Control Plane SaaS.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { db as supabase } from "@/runtime/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, Plus, Building2, RefreshCw, SlidersHorizontal, X, ArrowUpRight, Database, Server,
  MapPin, User, Mail, Phone, Users, FileText, CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { cn, searchNormalize } from "@/lib/utils";
import { PageHeader } from "@/components/superadmin/PageHeader";
import { StatusBadge, toneForTenantStatus } from "@/components/superadmin/StatusBadge";

interface TenantRow {
  id: string;
  nome: string;
  slug: string;
  status: string;
  created_at: string;
  lab_code: string;
  runtime_mode?: string | null;
  cidade?: string | null;
  estado?: string | null;
  responsavel_tecnico?: string | null;
  email_contato?: string | null;
  telefone?: string | null;
  cnpj?: string | null;
  metrics?: { usuarios: number; atendimentos: number; pacientes: number };
  admin?: { nome: string; email: string; telefone: string | null } | null;
  billing?: { plan_name: string | null; status: string | null; billing_cycle: string | null; mrr_cents: number };
}

type StatusFilter = "todos" | "ativo" | "suspenso" | "inativo";

export default function SuperAdminTenants() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");

  const { data: tenants = [], isLoading: loading, isFetching, refetch } = useQuery<TenantRow[]>({
    queryKey: ["super-admin", "tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("super-admin-list-tenants");
      if (error) { toast.error(error.message); throw error; }
      return (data?.tenants ?? []) as TenantRow[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
  const refreshing = isFetching && !loading;
  const load = () => { void refetch(); };

  const filtered = useMemo(() => {
    const term = searchNormalize(q);
    let list = tenants;
    if (statusFilter !== "todos") list = list.filter(t => t.status === statusFilter);
    if (!term) return list;
    return list.filter(t =>
      searchNormalize(t.nome).includes(term) ||
      searchNormalize(t.slug).includes(term) ||
      searchNormalize(t.lab_code || "").includes(term)
    );
  }, [tenants, q, statusFilter]);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto pb-10">
      <PageHeader
        title="Laboratórios"
        description="Gerenciamento centralizado de todos os laboratórios da plataforma."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={refreshing} className="rounded-full">
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} /> Atualizar
            </Button>
            <Button size="sm" onClick={() => navigate("/super-admin/laboratorios/novo")} className="rounded-full px-4">
              <Plus className="h-4 w-4 mr-2" /> Novo laboratório
            </Button>
          </div>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar laboratório..."
            className="pl-9 h-10 rounded-xl bg-card border-border/50 focus:ring-primary/20"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 rounded-xl px-4 gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              {statusFilter !== "todos" && (
                <span className="w-2 h-2 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2 rounded-xl">
             <div className="space-y-1">
               {["todos", "ativo", "suspenso", "inativo"].map(f => (
                 <button
                   key={f}
                   onClick={() => setStatusFilter(f as StatusFilter)}
                   className={cn(
                     "w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                     statusFilter === f ? "bg-primary/10 text-primary" : "hover:bg-muted"
                   )}
                 >
                   {f.charAt(0).toUpperCase() + f.slice(1)}
                 </button>
               ))}
             </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Pills de Filtro */}
      {statusFilter !== "todos" && (
        <div className="flex gap-2">
           <button 
             onClick={() => setStatusFilter("todos")}
             className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold"
           >
             Status: {statusFilter} <X className="h-3 w-3" />
           </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted/20 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(t => {
            const localidade = [t.cidade, t.estado].filter(Boolean).join(" / ") || "Localidade não informada";
            const adminNome = t.admin?.nome || t.responsavel_tecnico || "Sem responsável";
            const adminEmail = t.admin?.email || t.email_contato || "—";
            const telefone = t.admin?.telefone || t.telefone || "—";
            const planName = t.billing?.plan_name || "Sem plano";
            const mrr = ((t.billing?.mrr_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
            return (
              <Link
                key={t.id}
                to={`/super-admin/laboratorios/${t.lab_code}`}
                className="group block rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 transition-colors">
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-foreground truncate">{t.nome}</h4>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        /{t.slug} • Código: {t.lab_code || "—"}
                        {t.cnpj ? ` • CNPJ: ${t.cnpj}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge tone={toneForTenantStatus(t.status)} label={t.status} size="xs" />
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                      {t.runtime_mode === "isolated_db" ? (
                        <><Server className="h-3 w-3 text-primary" /> Banco dedicado</>
                      ) : (
                        <><Database className="h-3 w-3" /> Banco compartilhado</>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3 text-xs pl-0 md:pl-16">
                  <div className="flex items-start gap-2 min-w-0">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Localidade</div>
                      <div className="font-medium text-foreground truncate">{localidade}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Responsável</div>
                      <div className="font-medium text-foreground truncate">{adminNome}</div>
                      <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5" /> {adminEmail}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</div>
                      <div className="font-medium text-foreground truncate">{telefone}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 min-w-0">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Plano</div>
                      <div className="font-medium text-foreground truncate">{planName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{mrr}/mês</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/50 pl-0 md:pl-16 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Users className="h-3 w-3" /> {t.metrics?.usuarios ?? 0} usuários</span>
                  <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> {t.metrics?.atendimentos ?? 0} atendimentos</span>
                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {t.metrics?.pacientes ?? 0} pacientes</span>
                  <span className="ml-auto flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Abrir <ArrowUpRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
