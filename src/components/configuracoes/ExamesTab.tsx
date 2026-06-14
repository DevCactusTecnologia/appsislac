import React, { useState, useMemo, useEffect } from "react";
import { FlaskConical, Eye, Pencil, Trash2, Plus, Download, ChevronLeft, ChevronRight, Power, AlertTriangle, FileText, FileSpreadsheet, CheckCircle2, XCircle, Layers, Tags, ArrowUp, ArrowDown, ArrowUpDown, X, Building2, Search as SearchIcon, Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
// XLSX é carregado dinamicamente dentro de exportData (~430 KB).
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NovoExameDialog from "./NovoExameDialog";
import DetalhesExameDialog from "./DetalhesExameDialog";
import SetoresTab from "./SetoresTab";
import { getExamesCatalogo, toggleExameCatalogo, removeExameCatalogo, getExameCatalogoCompleto, updateExameCatalogo, type ExameCatalogo } from "@/data/exameCatalogoStore";
import { getLabsApoio } from "@/data/labApoioStore";
import { getSetoresCustomizados, loadSetoresCustomizados, isSetoresLoaded, subscribeSetoresCustomizados } from "@/data/setoresLaboratoriaisStore";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import SectionShell from "./_shared/SectionShell";
import Toolbar from "./_shared/Toolbar";
import EmptyState from "./_shared/EmptyState";
import LabBadge from "@/components/LabBadge";
import { searchNormalize } from "@/lib/utils";

type SubTab = "catalogo" | "setores";

interface Exame {
  id: string;
  mnemonico: string;
  nome: string;
  categoria: string;
  codigo: string;
  codigoTUSS: string;
  ativo: boolean;
  usadoEmAtendimento: boolean;
  setorId: string | null;
  tipoProcesso: "INTERNO" | "TERCEIRIZADO";
  labApoioId: string | null;
  codigoExameApoio: string;
}

const mapFromCatalogo = (c: ExameCatalogo): Exame => ({
  id: c.id,
  mnemonico: c.mnemonico,
  nome: c.nome,
  categoria: c.categoria,
  codigo: c.codigo,
  codigoTUSS: c.codigoTUSS,
  ativo: c.ativo,
  usadoEmAtendimento: c.usadoEmAtendimento,
  setorId: c.setorId,
  tipoProcesso: c.tipoProcesso,
  labApoioId: c.labApoioId,
  codigoExameApoio: c.codigoExameApoio,
});

type StatusFilter = "todos" | "ativo" | "inativo";
type SortKey = "nome" | "mnemonico" | "setor";
type SortDir = "asc" | "desc";
/** "todos" | "INTERNO" | <labId>  — fonte: tipo_processo + lab_apoio_id. */
type DestinoFilter = string;

interface LabAtivoLite { id: string; nome: string }

/** Pill compacta de filtro ativo (removível). */
const ActivePill: React.FC<{ label: string; icon?: React.ReactNode; onClear: () => void }> = ({ label, icon, onClear }) => (
  <span className="inline-flex items-center gap-1.5 h-7 pl-2 pr-1 rounded-lg border border-primary/25 bg-primary/8 text-primary text-[11px] font-medium">
    {icon}
    <span className="truncate max-w-[180px]">{label}</span>
    <button
      type="button"
      onClick={onClear}
      className="h-5 w-5 inline-flex items-center justify-center rounded-md hover:bg-primary/15 transition-colors"
      aria-label={`Remover filtro ${label}`}
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);

/** Popover único com TODOS os filtros (Status, Setor, Destino). */
const FiltersPopover: React.FC<{
  statusFilter: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  ativosCount: number;
  inativosCount: number;
  totalCount: number;
  setorFilter: string;
  onSetor: (id: string) => void;
  setoresDisponiveis: { id: string; nome: string }[];
  destinoFilter: DestinoFilter;
  onDestino: (d: DestinoFilter) => void;
  labsAtivos: LabAtivoLite[];
  countInterno: number;
  countPorLab: Map<string, number>;
  activeCount: number;
}> = ({
  statusFilter, onStatus, ativosCount, inativosCount, totalCount,
  setorFilter, onSetor, setoresDisponiveis,
  destinoFilter, onDestino, labsAtivos, countInterno, countPorLab,
  activeCount,
}) => {
  const [open, setOpen] = useState(false);
  const [labSearch, setLabSearch] = useState("");
  const labsFiltrados = useMemo(() => {
    const q = searchNormalize(labSearch);
    if (!q) return labsAtivos;
    return labsAtivos.filter((l) => searchNormalize(l.nome).includes(q));
  }, [labsAtivos, labSearch]);

  const Seg: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 h-8 px-3 rounded-lg text-[12px] font-medium transition-all inline-flex items-center justify-center gap-1.5 ${
        active ? "bg-background text-foreground shadow-sm border border-border/60" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );

  const Row: React.FC<{ active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; count?: number }> = ({ active, onClick, icon, label, count }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-left transition-colors ${
        active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50"
      }`}
    >
      <span className="inline-flex items-center gap-2 min-w-0">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 shrink-0">
        {typeof count === "number" && (
          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${active ? "bg-background/60" : "bg-muted/60 text-muted-foreground"}`}>{count}</span>
        )}
        {active && <Check className="h-3 w-3" />}
      </span>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-9 px-3 rounded-xl border text-[12px] font-medium inline-flex items-center gap-1.5 transition-all ${
            activeCount > 0
              ? "bg-primary/10 text-primary border-primary/30"
              : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-primary text-primary-foreground">{activeCount}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Filtros</p>
        </div>
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Status */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Status</p>
            <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/40">
              <Seg active={statusFilter === "todos"} onClick={() => onStatus("todos")}>Todos <span className="opacity-60">({totalCount})</span></Seg>
              <Seg active={statusFilter === "ativo"} onClick={() => onStatus("ativo")}>Ativos <span className="opacity-60">({ativosCount})</span></Seg>
              <Seg active={statusFilter === "inativo"} onClick={() => onStatus("inativo")}>Inativos <span className="opacity-60">({inativosCount})</span></Seg>
            </div>
          </div>

          {/* Setor */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Setor</p>
            <div className="relative">
              <select
                value={setorFilter}
                onChange={(e) => onSetor(e.target.value)}
                className="w-full appearance-none bg-background border border-border/60 rounded-xl pl-3 pr-8 h-9 text-[12px] text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                <option value="todos">Todos os setores</option>
                {setoresDisponiveis.map((s) => (
                  <option key={s.id} value={s.id}>{s.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Destino */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground">Destino</p>
              {labsAtivos.length > 5 && (
                <div className="relative w-32">
                  <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    value={labSearch}
                    onChange={(e) => setLabSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full h-6 pl-6 pr-2 bg-background border border-border/60 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
              )}
            </div>
            <div className="space-y-0.5">
              <Row active={destinoFilter === "todos"} onClick={() => onDestino("todos")} label="Todos os destinos" count={totalCount} />
              <Row
                active={destinoFilter === "INTERNO"}
                onClick={() => onDestino("INTERNO")}
                icon={<FlaskConical className="h-3.5 w-3.5 opacity-70" />}
                label="Interno"
                count={countInterno}
              />
              {labsFiltrados.length === 0 ? (
                <div className="px-2.5 py-2 text-[11px] text-muted-foreground italic">Nenhum lab encontrado</div>
              ) : labsFiltrados.map((lab) => (
                <Row
                  key={lab.id}
                  active={destinoFilter === lab.id}
                  onClick={() => onDestino(lab.id)}
                  icon={<Building2 className="h-3.5 w-3.5 opacity-70" />}
                  label={lab.nome}
                  count={countPorLab.get(lab.id) ?? 0}
                />
              ))}
            </div>
          </div>
        </div>
        {activeCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{activeCount} filtro(s) ativo(s)</span>
            <button
              type="button"
              onClick={() => { onStatus("todos"); onSetor("todos"); onDestino("todos"); }}
              className="text-[11px] font-medium text-primary hover:underline"
            >
              Limpar todos
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

const ExamesTab = () => {
  const [subTab, setSubTab] = useState<SubTab>("catalogo");
  const [exames, setExames] = useState<Exame[]>(() => getExamesCatalogo().map(mapFromCatalogo));

  const reloadExames = () => setExames(getExamesCatalogo().map(mapFromCatalogo));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [destinoFilter, setDestinoFilter] = useState<DestinoFilter>("todos");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExame, setEditingExame] = useState<Partial<ExameCatalogo> | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [viewingExame, setViewingExame] = useState<Exame | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Exame | null>(null);

  const openNew = () => { setEditingExame(null); setDialogOpen(true); };

  const labs = getLabsApoio();
  const labNomeById = useMemo(() => {
    const m = new Map<string, string>();
    labs.forEach((l) => m.set(l.id, l.nome));
    return m;
  }, [labs]);
  const labsAtivos = useMemo(() => labs.filter((l) => l.ativo), [labs]);
  // Setores: subscribe + lazy load
  const [setoresTick, setSetoresTick] = useState(0);
  useEffect(() => {
    if (!isSetoresLoaded()) loadSetoresCustomizados();
    const unsub = subscribeSetoresCustomizados(() => setSetoresTick((n) => n + 1));
    return () => { unsub(); };
  }, []);
  const setoresAll = useMemo(() => getSetoresCustomizados(), [setoresTick]);
  const setorNomeById = useMemo(() => {
    const m = new Map<string, string>();
    setoresAll.forEach((s) => m.set(s.id, s.nome));
    return m;
  }, [setoresAll]);
  const resolveSetorNome = (id: string | null) => (id ? (setorNomeById.get(id) ?? "—") : "—");
  // Setores presentes no catálogo (apenas os que existem em algum exame), ordenados
  const setoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    exames.forEach((e) => { if (e.setorId) set.add(e.setorId); });
    return Array.from(set)
      .map((id) => ({ id, nome: setorNomeById.get(id) ?? "—" }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [exames, setorNomeById]);

  /** Contagem por destino (Internos + cada lab) — derivado da fonte oficial. */
  const contagemPorDestino = useMemo(() => {
    const map = new Map<string, number>();
    let interno = 0;
    exames.forEach((e) => {
      if (e.tipoProcesso === "TERCEIRIZADO" && e.labApoioId) {
        map.set(e.labApoioId, (map.get(e.labApoioId) ?? 0) + 1);
      } else {
        interno += 1;
      }
    });
    return { interno, porLab: map };
  }, [exames]);

  const exportData = async (format: "pdf" | "excel") => {
    const data = filtered.map((e) => ({
      Mnemônico: e.mnemonico,
      Nome: e.nome,
      Categoria: e.categoria,
      Destino:
        e.tipoProcesso === "TERCEIRIZADO" && e.labApoioId
          ? `Apoio: ${labNomeById.get(e.labApoioId) ?? "—"}`
          : "Interno",
      Código: e.codigo,
      Status: e.ativo ? "Ativo" : "Inativo",
    }));

    if (format === "excel") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exames");
      XLSX.writeFile(wb, "exames.xlsx");
      toast({ title: "Exportado", description: "Arquivo Excel gerado com sucesso." });
    } else {
      const rows = data.map((d) => `<tr>${Object.values(d).map((v) => `<td style="border:1px solid #ddd;padding:6px 10px;font-size:12px">${v}</td>`).join("")}</tr>`).join("");
      const headers = Object.keys(data[0] || {}).map((h) => `<th style="border:1px solid #ddd;padding:6px 10px;font-size:11px;background:#f5f5f5;text-transform:uppercase">${h}</th>`).join("");
      printHtmlInHiddenFrame({
        html: `<html><head><title>Exames</title></head><body style="font-family:sans-serif"><h2 style="margin-bottom:12px">Lista de Exames</h2><table style="border-collapse:collapse;width:100%"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></body></html>`,
        frameId: "exames-print-frame",
      });
      toast({ title: "Exportado", description: "PDF gerado para impressão." });
    }
  };

  const openEdit = async (exame: Exame) => {
    // Two-tier cache: o boot carrega apenas colunas leves. Antes de abrir o
    // modal de edição buscamos a versão COMPLETA do catálogo, garantindo que
    // TODOS os campos pesados (preparoPaciente, sinonimos, estabilidade,
    // recipiente, etc.) cheguem ao formulário — sem isso haveria perda
    // silenciosa no save (campos sobrescritos por defaults vazios).
    if (loadingEditId) return; // anti race-condition em múltiplos cliques
    setLoadingEditId(exame.id);
    try {
      const cat = await getExameCatalogoCompleto(exame.id);
      if (!cat) {
        toast({ title: "Erro", description: "Não foi possível carregar o exame.", variant: "destructive" });
        return;
      }
      setEditingExame(cat);
      setDialogOpen(true);
    } finally {
      setLoadingEditId(null);
    }
  };
  const openDetalhes = (exame: Exame) => { setViewingExame(exame); setDetalhesOpen(true); };

  const toggleAtivo = async (exame: Exame) => {
    const ok = await toggleExameCatalogo(exame.id);
    if (!ok) {
      toast({ title: "Erro", description: "Não foi possível alterar o status do exame.", variant: "destructive" });
      return;
    }
    reloadExames();
    toast({
      title: exame.ativo ? "Exame desativado" : "Exame ativado",
      description: `O exame "${exame.mnemonico}" foi ${exame.ativo ? "desativado" : "ativado"} com sucesso.`,
    });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.usadoEmAtendimento) return;
    const ok = await removeExameCatalogo(deleteConfirm.id);
    if (!ok) {
      toast({ title: "Erro ao excluir", description: "Não foi possível remover o exame.", variant: "destructive" });
      return;
    }
    reloadExames();
    toast({ title: "Exame excluído", description: `O exame "${deleteConfirm.mnemonico}" foi removido.` });
    setDeleteConfirm(null);
  };

  const filtered = useMemo(() => {
    let list = exames;
    if (statusFilter === "ativo") list = list.filter(e => e.ativo);
    if (statusFilter === "inativo") list = list.filter(e => !e.ativo);
    if (setorFilter !== "todos") {
      list = list.filter((e) => (e.setorId ?? "__none__") === setorFilter);
    }
    if (destinoFilter !== "todos") {
      if (destinoFilter === "INTERNO") {
        list = list.filter((e) => e.tipoProcesso === "INTERNO");
      } else {
        list = list.filter((e) => e.tipoProcesso === "TERCEIRIZADO" && e.labApoioId === destinoFilter);
      }
    }
    const term = searchNormalize(search);
    if (term) {
      list = list.filter((e) => {
        const nome = e.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const mnem = e.mnemonico.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nome.includes(term) || mnem.includes(term) || searchNormalize(e.codigo).includes(term);
      });
    }
    // Ordenação
    const dir = sortDir === "asc" ? 1 : -1;
    const getKey = (e: Exame): string => {
      if (sortKey === "mnemonico") return e.mnemonico || "";
      if (sortKey === "setor") return resolveSetorNome(e.setorId);
      return e.nome || "";
    };
    return [...list].sort((a, b) => getKey(a).localeCompare(getKey(b), "pt-BR", { sensitivity: "base" }) * dir);
  }, [search, exames, statusFilter, setorFilter, destinoFilter, sortKey, sortDir, setorNomeById]);

  const semTussCount = useMemo(() => exames.filter(e => e.ativo && !e.codigoTUSS).length, [exames]);
  const ativosCount = exames.filter(e => e.ativo).length;
  const inativosCount = exames.length - ativosCount;
  const terceirizadosCount = exames.filter((e) => e.tipoProcesso === "TERCEIRIZADO").length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSearch = (val: string) => { setSearch(val); setPage(1); };
  const setStatus = (s: StatusFilter) => { setStatusFilter(s); setPage(1); };
  const setSetor = (id: string) => { setSetorFilter(id); setPage(1); };
  const setDestino = (d: DestinoFilter) => { setDestinoFilter(d); setPage(1); setSelecionados(new Set()); };
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };
  const hasActiveFilters = !!search.trim() || statusFilter !== "todos" || setorFilter !== "todos" || destinoFilter !== "todos";
  const limparFiltros = () => {
    setSearch("");
    setStatusFilter("todos");
    setSetorFilter("todos");
    setDestino("todos");
    setPage(1);
  };

  /** Aplica destino em massa via updateExameCatalogo (fonte oficial: tipo_processo + lab_apoio_id). */
  const aplicarDestinoEmMassa = async (alvo: { tipoProcesso: "INTERNO" | "TERCEIRIZADO"; labApoioId: string | null }) => {
    const ids = Array.from(selecionados);
    if (ids.length === 0) { setBulkOpen(false); return; }
    let ok = 0;
    for (const id of ids) {
      const success = await updateExameCatalogo(id, {
        tipoProcesso: alvo.tipoProcesso,
        labApoioId: alvo.labApoioId,
      });
      if (success) ok += 1;
    }
    reloadExames();
    setSelecionados(new Set());
    setBulkOpen(false);
    const labelDest = alvo.tipoProcesso === "INTERNO" ? "Interno" : (labNomeById.get(alvo.labApoioId ?? "") ?? "Apoio");
    toast({
      title: `Destino atualizado em ${ok} exame(s)`,
      description: `Novo destino: ${labelDest}.`,
    });
  };

  const allOnPageSelected = paginated.length > 0 && paginated.every((e) => selecionados.has(e.id));
  const togglePageSelection = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginated.forEach((e) => next.delete(e.id));
      } else {
        paginated.forEach((e) => next.add(e.id));
      }
      return next;
    });
  };
  const toggleRowSelection = (id: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const pageNumbers = useMemo(() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    // Janela deslizante em torno da página atual: 1 … (p-1) p (p+1) … N
    const add = (n: number) => { if (!pages.includes(n)) pages.push(n); };
    add(1);
    if (page > 3) pages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i);
    if (page < totalPages - 2) pages.push("...");
    add(totalPages);
    return pages;
  }, [totalPages, page]);

  // Sub-abas (Catálogo / Setores)
  const SubTabs = (
    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-muted/40 border border-border/40 w-fit mb-4">
      <button
        type="button"
        onClick={() => setSubTab("catalogo")}
        className={`h-9 px-4 rounded-xl text-[12px] font-semibold inline-flex items-center gap-2 transition-all ${
          subTab === "catalogo"
            ? "bg-background text-foreground shadow-sm border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <FlaskConical className="h-3.5 w-3.5" /> Catálogo
      </button>
      <button
        type="button"
        onClick={() => setSubTab("setores")}
        className={`h-9 px-4 rounded-xl text-[12px] font-semibold inline-flex items-center gap-2 transition-all ${
          subTab === "setores"
            ? "bg-background text-foreground shadow-sm border border-border/60"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Tags className="h-3.5 w-3.5" /> Setores
      </button>
    </div>
  );

  if (subTab === "setores") {
    return (
      <React.Fragment>
        {SubTabs}
        <SetoresTab />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {SubTabs}
      <SectionShell
        icon={<FlaskConical className="h-5 w-5 text-primary" />}
        title="Catálogo de exames"
        description="Cadastre, ative e gerencie os exames disponíveis no laboratório"
        meta={
          <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
            {ativosCount}/{exames.length} ativos
          </span>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl text-xs h-9 gap-2">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => exportData("pdf")} className="gap-2 text-xs cursor-pointer">
                  <FileText className="h-3.5 w-3.5" /> Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("excel")} className="gap-2 text-xs cursor-pointer">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button className="rounded-xl text-xs h-9 gap-2" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Novo exame
            </Button>
          </>
        }
        toolbar={
          <div className="space-y-3">
            {/* Linha única: busca + Filtros (popover unificado) + meta discreta */}
            <Toolbar
              searchValue={search}
              onSearchChange={handleSearch}
              searchPlaceholder="Buscar por nome, mnemônico ou código..."
              trailing={
                <>
                  <FiltersPopover
                    statusFilter={statusFilter}
                    onStatus={setStatus}
                    ativosCount={ativosCount}
                    inativosCount={inativosCount}
                    totalCount={exames.length}
                    setorFilter={setorFilter}
                    onSetor={setSetor}
                    setoresDisponiveis={setoresDisponiveis}
                    destinoFilter={destinoFilter}
                    onDestino={setDestino}
                    labsAtivos={labsAtivos}
                    countInterno={contagemPorDestino.interno}
                    countPorLab={contagemPorDestino.porLab}
                    activeCount={
                      (statusFilter !== "todos" ? 1 : 0) +
                      (setorFilter !== "todos" ? 1 : 0) +
                      (destinoFilter !== "todos" ? 1 : 0)
                    }
                  />
                  <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" /> {terceirizadosCount} terceirizado(s)
                  </span>
                </>
              }
            />
            {/* Pills dos filtros ATIVOS — cada uma removível individualmente */}
            {hasActiveFilters && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {statusFilter !== "todos" && (
                  <ActivePill
                    label={statusFilter === "ativo" ? "Apenas ativos" : "Apenas inativos"}
                    onClear={() => setStatus("todos")}
                  />
                )}
                {setorFilter !== "todos" && (
                  <ActivePill
                    icon={<Tags className="h-3 w-3" />}
                    label={`Setor: ${setorNomeById.get(setorFilter) ?? "—"}`}
                    onClear={() => setSetor("todos")}
                  />
                )}
                {destinoFilter !== "todos" && (
                  <ActivePill
                    icon={destinoFilter === "INTERNO" ? <FlaskConical className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                    label={destinoFilter === "INTERNO" ? "Destino: Interno" : `Destino: ${labNomeById.get(destinoFilter) ?? "Apoio"}`}
                    onClear={() => setDestino("todos")}
                  />
                )}
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="h-7 px-2 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 inline-flex items-center gap-1 transition-colors"
                >
                  Limpar tudo
                </button>
              </div>
            )}
            {/* Barra de ação em massa — só aparece quando há seleção */}
            {selecionados.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="text-[12px] font-semibold text-primary">
                  {selecionados.size} selecionado(s)
                </span>
                <div className="relative ml-auto">
                  <Button
                    size="sm"
                    className="rounded-lg text-xs h-8 gap-1.5"
                    onClick={() => setBulkOpen((v) => !v)}
                  >
                    <Building2 className="h-3.5 w-3.5" /> Definir destino
                  </Button>
                  {bulkOpen && (
                    <div className="absolute right-0 top-9 z-20 w-56 rounded-xl border border-border bg-card shadow-lg p-1.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => aplicarDestinoEmMassa({ tipoProcesso: "INTERNO", labApoioId: null })}
                        className="w-full text-left px-3 py-2 rounded-lg text-[12px] hover:bg-muted/60 inline-flex items-center gap-2"
                      >
                        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" /> Interno
                      </button>
                      <div className="h-px bg-border/40 my-0.5" />
                      {labsAtivos.length === 0 ? (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground italic">Nenhum lab de apoio ativo</p>
                      ) : labsAtivos.map((lab) => (
                        <button
                          key={lab.id}
                          type="button"
                          onClick={() => aplicarDestinoEmMassa({ tipoProcesso: "TERCEIRIZADO", labApoioId: lab.id })}
                          className="w-full text-left px-3 py-2 rounded-lg text-[12px] hover:bg-muted/60 inline-flex items-center gap-2"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> {lab.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelecionados(new Set())}
                  className="h-8 px-2 rounded-lg text-[12px] text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>
        }
        banner={
          semTussCount > 0 ? (
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-foreground">
                <span className="font-semibold text-warning">{semTussCount}</span>{" "}
                {semTussCount === 1 ? "exame ativo está" : "exames ativos estão"} sem código TUSS.
                Risco de <span className="font-medium">glosa em faturamento</span> de convênios (ANS RN 501/2022 — Padrão TISS).
              </div>
            </div>
          ) : undefined
        }
        bodyless
      >
        <div className="px-5 sm:px-6 py-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="Nenhum exame encontrado"
              description={search || statusFilter !== "todos" ? "Ajuste a busca ou os filtros para tentar novamente." : "Cadastre o primeiro exame para começar."}
            />
          ) : (
            <div>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/30 text-left">
                      <th className="py-2.5 px-3 w-[40px]">
                        <input
                          type="checkbox"
                          aria-label="Selecionar página"
                          checked={allOnPageSelected}
                          onChange={togglePageSelection}
                          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                        <button type="button" onClick={() => toggleSort("nome")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          Exame <SortIcon k="nome" />
                        </button>
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[160px]">
                        <button type="button" onClick={() => toggleSort("setor")} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                          Setor <SortIcon k="setor" />
                        </button>
                      </th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[200px]">Destino</th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[100px]">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider w-[160px] text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((exame) => (
                      <tr
                        key={exame.id}
                        onClick={() => openDetalhes(exame)}
                        className={`border-t border-border/30 hover:bg-muted/20 transition-colors cursor-pointer ${!exame.ativo ? "opacity-60" : ""} ${selecionados.has(exame.id) ? "bg-primary/5" : ""}`}
                      >
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label="Selecionar exame"
                            checked={selecionados.has(exame.id)}
                            onChange={() => toggleRowSelection(exame.id)}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 min-w-0">
                          <div className="flex flex-col items-start gap-1 min-w-0">
                            <p className="font-semibold text-foreground leading-tight truncate max-w-full" title={exame.nome}>
                              {exame.nome}
                            </p>
                            <span className="inline-flex items-center font-mono text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md whitespace-nowrap max-w-full truncate">
                              {exame.mnemonico}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[12px] text-foreground">{resolveSetorNome(exame.setorId)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <LabBadge
                            tipoProcesso={exame.tipoProcesso}
                            labApoioId={exame.labApoioId}
                            labApoioNome={exame.labApoioId ? labNomeById.get(exame.labApoioId) ?? null : null}
                            hideSigla
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg ${
                            exame.ativo
                              ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {exame.ativo ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {exame.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openDetalhes(exame)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Ver detalhes">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button onClick={() => toggleAtivo(exame)} className={`p-1.5 rounded-lg transition-colors ${exame.ativo ? "hover:bg-warning/10 text-muted-foreground hover:text-warning" : "hover:bg-[hsl(var(--status-success))]/10 text-muted-foreground hover:text-[hsl(var(--status-success))]"}`} title={exame.ativo ? "Desativar" : "Ativar"}>
                              <Power className="h-4 w-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(exame)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Excluir">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2.5">
                {paginated.map((exame) => (
                  <div
                    key={exame.id}
                    onClick={() => openDetalhes(exame)}
                    className={`p-3 border border-border/50 rounded-xl bg-card hover:bg-muted/20 transition-colors cursor-pointer ${!exame.ativo ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{exame.mnemonico}</span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            exame.ativo
                              ? "bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))]"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {exame.ativo ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
                            {exame.ativo ? "Ativo" : "Inativo"}
                          </span>
                          {exame.ativo && !exame.codigoTUSS && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning/10 text-warning">
                              <AlertTriangle className="h-2.5 w-2.5" /> Sem TUSS
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground mt-1.5 text-sm leading-tight">{exame.nome}</p>
                        <p className="text-[11px] text-muted-foreground">{exame.categoria}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {exame.tipoProcesso === "TERCEIRIZADO" && exame.labApoioId
                            ? `Apoio · ${labNomeById.get(exame.labApoioId) ?? "—"}`
                            : "Interno"} · <span className="font-mono">{exame.codigo}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleAtivo(exame)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Power className="h-4 w-4" /></button>
                        <button onClick={() => setDeleteConfirm(exame)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-8 w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-30 inline-flex items-center justify-center"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {pageNumbers.map((p, idx) =>
                    p === "..." ? (
                      <span key={`dots-${idx}`} className="px-2 text-muted-foreground text-sm">...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`h-8 w-8 rounded-lg text-[12px] font-semibold transition-colors ${
                          page === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-8 w-8 rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-30 inline-flex items-center justify-center"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>
                    Mostrando {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} de {filtered.length}
                  </span>
                  <div className="relative">
                    <select
                      value={perPage}
                      onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                      className="appearance-none bg-background border border-border/60 rounded-lg pl-3 pr-7 h-8 text-[11px] text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30"
                    >
                      <option value={8}>8 por página</option>
                      <option value={15}>15 por página</option>
                      <option value={25}>25 por página</option>
                      <option value={50}>50 por página</option>
                      <option value={100}>100 por página</option>
                      <option value={200}>200 por página</option>
                    </select>
                    <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none rotate-90" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionShell>

      <NovoExameDialog open={dialogOpen} onClose={() => { setDialogOpen(false); reloadExames(); }} editData={editingExame} />
      <DetalhesExameDialog
        open={detalhesOpen}
        onClose={() => setDetalhesOpen(false)}
        exame={viewingExame ? { ...viewingExame, setorNome: resolveSetorNome(viewingExame.setorId) } : null}
        onEdit={() => { setDetalhesOpen(false); if (viewingExame) openEdit(viewingExame); }}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-md rounded-3xl border-border/60 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden">
          <div className="px-6 py-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${deleteConfirm?.usadoEmAtendimento ? "bg-warning/8" : "bg-destructive/8"}`}>
                <AlertTriangle className={`h-5 w-5 ${deleteConfirm?.usadoEmAtendimento ? "text-warning" : "text-destructive"}`} />
              </div>
              <DialogTitle className="text-[15px] font-semibold text-foreground tracking-tight">
                {deleteConfirm?.usadoEmAtendimento ? "Exclusão não permitida" : "Confirmar exclusão"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {deleteConfirm?.usadoEmAtendimento
                ? `O exame "${deleteConfirm?.mnemonico}" já foi utilizado em atendimentos e não pode ser excluído. Você pode desativá-lo para que não apareça em novos atendimentos.`
                : `Tem certeza que deseja excluir o exame "${deleteConfirm?.mnemonico}"? Esta ação não poderá ser desfeita.`}
            </DialogDescription>
          </div>
          <div className="h-px bg-border/50" />
          <div className="flex items-center justify-end gap-3 px-6 py-4">
            <button onClick={() => setDeleteConfirm(null)} className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted/30 transition-all duration-200">
              {deleteConfirm?.usadoEmAtendimento ? "Entendi" : "Cancelar"}
            </button>
            {deleteConfirm?.usadoEmAtendimento ? (
              <button
                onClick={() => { if (deleteConfirm) toggleAtivo(deleteConfirm); setDeleteConfirm(null); }}
                className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-2 transition-all duration-200"
              >
                <Power className="h-3.5 w-3.5" /> Desativar exame
              </button>
            ) : (
              <button onClick={handleDelete} className="h-11 px-6 rounded-2xl bg-destructive text-destructive-foreground text-[13px] font-semibold hover:opacity-90 transition-all duration-200 shadow-sm">
                Excluir
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </React.Fragment>
  );
};

export default ExamesTab;
