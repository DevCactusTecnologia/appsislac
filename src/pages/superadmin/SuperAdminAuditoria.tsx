// Auditoria global do SaaS — agrega o atendimento_audit de todos os tenants.

import { useEffect, useMemo, useState } from "react";
import { db as supabase } from "@/runtime/db";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, History, Building2, Activity, AlertTriangle, ShieldCheck,
  Clock, User as UserIcon, FileSearch, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn, searchNormalize } from "@/lib/utils";

interface AuditRow {
  id: number;
  acao: string;
  entidade: string;
  operacao: string;
  protocolo: string;
  paciente_nome: string;
  exame_nome: string;
  changed_by_email: string;
  changed_at: string;
  tenant_id: string | null;
  pos_finalizacao?: boolean;
  resultado_critico?: boolean;
}

interface TenantMini { id: string; nome: string }

export default function SuperAdminAuditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    setLoading(true);
    const [audit, tlist] = await Promise.all([
      supabase
        .from("atendimento_audit")
        .select("id,acao,entidade,operacao,protocolo,paciente_nome,exame_nome,changed_by_email,changed_at,tenant_id,pos_finalizacao,resultado_critico")
        .order("changed_at", { ascending: false })
        .limit(500),
      supabase.from("tenants").select("id,nome"),
    ]);
    if (audit.data) setRows(audit.data as AuditRow[]);
    if (tlist.data) setTenants(new Map((tlist.data as TenantMini[]).map(t => [t.id, t.nome])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = searchNormalize(q);
    return rows.filter(r => {
      if (tenantFilter !== "all" && r.tenant_id !== tenantFilter) return false;
      if (!term) return true;
      return (
        searchNormalize((r.acao || "")).includes(term) ||
        searchNormalize((r.protocolo || "")).includes(term) ||
        searchNormalize((r.paciente_nome || "")).includes(term) ||
        searchNormalize((r.changed_by_email || "")).includes(term)
      );
    });
  }, [rows, q, tenantFilter]);

  // Reset para a primeira página sempre que filtro/busca mudar
  useEffect(() => { setPage(1); }, [q, tenantFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filtered.length);
  const paged = filtered.slice(startIdx, endIdx);

  const stats = useMemo(() => {
    const total = rows.length;
    const labs = new Set(rows.map(r => r.tenant_id).filter(Boolean)).size;
    const posFin = rows.filter(r => r.pos_finalizacao).length;
    const criticos = rows.filter(r => r.resultado_critico).length;
    return { total, labs, posFin, criticos };
  }, [rows]);

  return (
    <div className="pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 sm:p-8 mb-6">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4 sm:gap-5 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shrink-0 shadow-[0_12px_32px_-8px_hsl(var(--primary)/0.6)]">
              <History className="h-7 w-7 sm:h-8 sm:w-8 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Auditoria global
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Últimos 500 eventos de auditoria registrados em todos os laboratórios da plataforma.
              </p>
            </div>
          </div>
        </div>

        {/* Métricas */}
        <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Activity} label="Eventos" value={stats.total} tone="primary" />
          <Stat icon={Building2} label="Laboratórios" value={stats.labs} tone="emerald" />
          <Stat icon={ShieldCheck} label="Pós-finalização" value={stats.posFin} tone="amber" />
          <Stat icon={AlertTriangle} label="Críticos" value={stats.criticos} tone="violet" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por ação, protocolo, paciente ou usuário..."
              className="pl-9 h-10 rounded-xl bg-background"
            />
          </div>
          <select
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm min-w-[220px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={tenantFilter}
            onChange={e => setTenantFilter(e.target.value)}
          >
            <option value="all">Todos os laboratórios</option>
            {Array.from(tenants.entries()).map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
            <FileSearch className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Nenhum evento encontrado</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Ajuste os filtros ou aguarde novas atividades nos laboratórios.
          </p>
        </div>
      ) : (
        <>
          {/* Tabela (md+) */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Quando</th>
                    <th className="text-left px-4 py-3 font-semibold">Laboratório</th>
                    <th className="text-left px-4 py-3 font-semibold">Ação</th>
                    <th className="text-left px-5 py-3 font-semibold">Paciente / Exame</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(r => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        {r.protocolo && (
                          <div className="font-mono text-xs text-foreground">{r.protocolo}</div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(r.changed_at).toLocaleString("pt-BR")}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="text-[11px] text-muted-foreground truncate">
                          {r.changed_by_email || "—"}
                        </div>
                        <div className="text-foreground truncate">
                          {r.tenant_id ? tenants.get(r.tenant_id) ?? r.tenant_id.slice(0, 8) : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-foreground">{r.acao || r.operacao}</span>
                          {r.pos_finalizacao && <FlagPill tone="amber">pós-final</FlagPill>}
                          {r.resultado_critico && <FlagPill tone="rose">crítico</FlagPill>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        <div className="truncate max-w-[280px]">
                          <span className="text-foreground">{r.paciente_nome || "—"}</span>
                          {r.exame_nome && <span className="text-xs"> · {r.exame_nome}</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden grid gap-3">
            {paged.map(r => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-foreground font-semibold text-sm flex-wrap">
                      {r.acao || r.operacao}
                      {r.pos_finalizacao && <FlagPill tone="amber">pós-final</FlagPill>}
                      {r.resultado_critico && <FlagPill tone="rose">crítico</FlagPill>}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {new Date(r.changed_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  {r.protocolo && (
                    <span className="font-mono text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-0.5 shrink-0">
                      {r.protocolo}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-1 gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">
                      {r.tenant_id ? tenants.get(r.tenant_id) ?? r.tenant_id.slice(0, 8) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{r.changed_by_email || "—"}</span>
                  </div>
                  {(r.paciente_nome || r.exame_nome) && (
                    <div className="text-muted-foreground truncate">
                      <span className="text-foreground">{r.paciente_nome || "—"}</span>
                      {r.exame_nome && <> · {r.exame_nome}</>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            total={filtered.length}
            startIdx={startIdx}
            endIdx={endIdx}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "amber" | "violet";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    violet: "bg-violet-500/10 text-violet-600",
  };
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 backdrop-blur-sm p-3 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", toneMap[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</div>
        <div className="text-lg font-bold text-foreground tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
}

function FlagPill({ tone, children }: { tone: "amber" | "rose"; children: React.ReactNode }) {
  const map = {
    amber: "bg-amber-500/10 text-amber-700 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  };
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0 rounded-md text-[10px] font-semibold border",
      map[tone],
    )}>
      {children}
    </span>
  );
}

function PaginationBar({
  page, totalPages, pageSize, total, startIdx, endIdx,
  onPageChange, onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  startIdx: number;
  endIdx: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const pages = useMemo(() => buildPageList(page, totalPages), [page, totalPages]);

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          Exibindo <span className="font-semibold text-foreground tabular-nums">{total === 0 ? 0 : startIdx + 1}–{endIdx}</span> de{" "}
          <span className="font-semibold text-foreground tabular-nums">{total}</span>
        </span>
        <div className="hidden sm:flex items-center gap-1.5">
          <span>Itens por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`gap-${idx}`} className="px-1.5 text-xs text-muted-foreground select-none">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "h-8 min-w-[2rem] px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors",
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-accent"
              )}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          aria-label="Próxima página"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Constrói lista compacta de páginas com elipses (ex.: 1 … 4 5 6 … 12). */
function buildPageList(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}
