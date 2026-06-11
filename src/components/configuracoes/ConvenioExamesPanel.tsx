import { useState, useEffect, useMemo } from "react";
import {
  Search,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileDown,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  getExamesCatalogoAtivos,
  subscribeExamesCatalogo,
  type ExameCatalogo,
} from "@/data/exameCatalogoStore";
import {
  type TabelaTipo,
  getItensByTabela,
  getItensOrfaos,
  upsertPrecoByExame,
  removeItemTabelaPreco,
  toggleItemTabelaPreco,
  subscribeTabelaPreco,
  type ItemTabelaPreco,
} from "@/data/tabelaPrecoStore";
// XLSX é carregado dinamicamente em handleExportExcel (~430 KB).

interface ConvenioExamesPanelProps {
  convenioNome: string;
  tabela: string;
}

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface RowView {
  exame: ExameCatalogo;
  precoId: number | null;
  valor: number | null;
  ativo: boolean;
  codigoExibido: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const ConvenioExamesPanel = ({ convenioNome, tabela }: ConvenioExamesPanelProps) => {
  const { toast } = useToast();
  const tabelaTipo = tabela as TabelaTipo;
  const [search, setSearch] = useState("");
  const [editingExameId, setEditingExameId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [tick, setTick] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [destinoFiltro, setDestinoFiltro] = useState<"TODOS" | "INTERNO" | "TERCEIRIZADO">("TODOS");

  useEffect(() => {
    const u1 = subscribeTabelaPreco(() => setTick(t => t + 1));
    const u2 = subscribeExamesCatalogo(() => setTick(t => t + 1));
    return () => {
      u1();
      u2();
    };
  }, []);

  const rows: RowView[] = useMemo(() => {
    const ativos = getExamesCatalogoAtivos();
    const precos = getItensByTabela(tabelaTipo);
    const mapa = new Map(precos.map(p => [p.exameId, p]));
    return ativos.map(exame => {
      const p = mapa.get(exame.id);
      const codigo =
        tabelaTipo === "CBHPM"
          ? exame.codigoCBHPM
          : tabelaTipo === "TUSS"
            ? exame.codigoTUSS
            : exame.mnemonico;
      return {
        exame,
        precoId: p?.id ?? null,
        valor: p ? p.valor : null,
        ativo: p ? p.ativo : true,
        codigoExibido: codigo || exame.mnemonico,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabelaTipo, tick]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return rows.filter(r => {
      if (destinoFiltro !== "TODOS" && r.exame.tipoProcesso !== destinoFiltro) return false;
      if (!q) return true;
      return (
        normalize(r.exame.nome).includes(q) ||
        normalize(r.codigoExibido).includes(q)
      );
    });
  }, [rows, search, destinoFiltro]);

  // Destinos ativos = aqueles com ≥1 exame no conjunto atual
  const destinosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => set.add(r.exame.tipoProcesso));
    return set;
  }, [rows]);

  const totalCobertura = rows.filter(r => r.valor !== null && r.valor > 0).length;
  const orfaos: ItemTabelaPreco[] = useMemo(
    () => getItensOrfaos(tabelaTipo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabelaTipo, tick],
  );

  // Reset page on search/tab/pageSize change
  useEffect(() => {
    setPage(1);
  }, [search, tabelaTipo, pageSize, destinoFiltro]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, filtered.length);

  const startEdit = (row: RowView) => {
    setEditingExameId(row.exame.id);
    setEditValue(row.valor !== null ? String(row.valor) : "");
  };

  const saveEdit = async (row: RowView) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    const ok = await upsertPrecoByExame(row.exame.id, tabelaTipo, val);
    setEditingExameId(null);
    if (!ok) { toast({ title: "Falha ao salvar preço", variant: "destructive" }); return; }
    toast({ title: row.precoId ? "Preço atualizado" : "Preço definido" });
  };

  const handleToggle = async (row: RowView) => {
    if (!row.precoId) return;
    const ok = await toggleItemTabelaPreco(row.precoId);
    if (!ok) toast({ title: "Falha ao alterar status", variant: "destructive" });
  };

  const handleRemove = async (row: RowView) => {
    if (!row.precoId) return;
    const ok = await removeItemTabelaPreco(row.precoId);
    toast({
      title: ok ? "Preço removido" : "Falha ao remover",
      variant: ok ? undefined : "destructive",
    });
  };

  const exportRows = () =>
    filtered.map(r => ({
      Codigo: r.codigoExibido,
      Exame: r.exame.nome,
      Destino: r.exame.tipoProcesso === "TERCEIRIZADO" ? "Apoio" : "Interno",
      Valor: r.valor ?? 0,
      Status: r.valor === null ? "Sem preço" : r.ativo ? "Ativo" : "Inativo",
    }));

  const fileBase = `tabela-${tabela}-${convenioNome}`.replace(/\s+/g, "_");

  const handleExportExcel = async () => {
    const data = exportRows();
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exames");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
    toast({ title: `Exportados ${data.length} exames` });
  };

  const handleExportPDF = async () => {
    const data = exportRows();
    const html2pdf = (await import("html2pdf.js")).default as unknown as (
      el: HTMLElement,
    ) => { set: (opts: unknown) => { save: () => Promise<void> } };
    const wrapper = document.createElement("div");
    wrapper.style.padding = "16px";
    wrapper.style.fontFamily = "Inter, Arial, sans-serif";
    wrapper.style.color = "#111";
    const destinoTxt = destinoFiltro === "TODOS" ? "Todos" : destinoFiltro === "INTERNO" ? "Interno" : "Apoio";
    const esc = (v: unknown): string => {
      if (v === null || v === undefined) return "";
      return String(v)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/`/g, "&#96;");
    };
    wrapper.innerHTML = `
      <h2 style="margin:0 0 4px 0;font-size:16px;">Tabela ${esc(tabela)} — ${esc(convenioNome)}</h2>
      <p style="margin:0 0 12px 0;font-size:11px;color:#555;">Destino: ${esc(destinoTxt)} · Total: ${data.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;">Código</th>
            <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;">Exame</th>
            <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;">Destino</th>
            <th style="text-align:right;padding:6px;border:1px solid #e5e7eb;">Valor</th>
            <th style="text-align:left;padding:6px;border:1px solid #e5e7eb;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${data
            .map(
              r => `<tr>
                <td style="padding:5px;border:1px solid #e5e7eb;font-family:monospace;">${esc(r.Codigo)}</td>
                <td style="padding:5px;border:1px solid #e5e7eb;">${esc(r.Exame)}</td>
                <td style="padding:5px;border:1px solid #e5e7eb;">${esc(r.Destino)}</td>
                <td style="padding:5px;border:1px solid #e5e7eb;text-align:right;">${r.Valor === 0 && r.Status === "Sem preço" ? "—" : r.Valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                <td style="padding:5px;border:1px solid #e5e7eb;">${esc(r.Status)}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    document.body.appendChild(wrapper);
    try {
      await html2pdf(wrapper)
        .set({
          margin: 10,
          filename: `${fileBase}.pdf`,
          html2canvas: { scale: 2 },
          jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
        })
        .save();
      toast({ title: `Exportados ${data.length} exames` });
    } finally {
      wrapper.remove();
    }
  };

  return (
    <div className="border-t border-border bg-card">
      {/* Header da seção (não-sticky) */}
      <div className="px-5 py-3 flex flex-col sm:flex-row sm:items-start gap-3 border-b border-border bg-muted/10">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-bold text-foreground">
            Exames — Tabela {tabela} ({convenioNome})
          </span>
          <span className="text-[11px] text-muted-foreground">
            Cobertura:{" "}
            <span className="font-semibold text-foreground">{totalCobertura}</span> de{" "}
            {rows.length} exames precificados
          </span>
        </div>
        <div className="flex-1 flex items-center justify-end gap-2 sm:self-center">
          {orfaos.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-destructive/10 text-destructive text-[11px] font-semibold border border-destructive/30"
              title="Linhas em tabela_preco_itens cujo exame_id não existe em exames_catalogo"
            >
              <AlertTriangle className="h-3 w-3" />
              {orfaos.length} órfão{orfaos.length > 1 ? "s" : ""}
            </span>
          )}
          {destinosDisponiveis.size > 0 && (
            <select
              value={destinoFiltro}
              onChange={e => setDestinoFiltro(e.target.value as typeof destinoFiltro)}
              className="h-8 px-2 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Filtrar por destino"
            >
              <option value="TODOS">Todos os destinos</option>
              {destinosDisponiveis.has("INTERNO") && <option value="INTERNO">Interno</option>}
              {destinosDisponiveis.has("TERCEIRIZADO") && <option value="TERCEIRIZADO">Apoio</option>}
            </select>
          )}
          <button
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Exportar para Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background text-foreground text-xs font-medium hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Exportar para PDF"
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 rounded-xl h-8 text-xs"
              placeholder="Buscar exame..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {orfaos.length > 0 && (
        <div className="px-5 py-2.5 border-b border-destructive/20 bg-destructive/5">
          <div className="flex items-start gap-2 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-destructive font-semibold mb-1">
                {orfaos.length} preço{orfaos.length > 1 ? "s" : ""} sem exame correspondente no catálogo
              </p>
              <ul className="space-y-0.5 text-muted-foreground font-mono text-[10px]">
                {orfaos.slice(0, 5).map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">exame_id: {o.exameId || "—"} · valor: R$ {o.valor.toFixed(2)}</span>
                    <button
                      onClick={() => removeItemTabelaPreco(o.id)}
                      className="text-destructive hover:underline shrink-0"
                    >
                      remover
                    </button>
                  </li>
                ))}
                {orfaos.length > 5 && <li className="italic">… e mais {orfaos.length - 5}.</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tabela: header NÃO-sticky para evitar sobreposição visual */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-xs">
          <thead className="bg-muted/30 border-b border-border">
            <tr className="text-left">
              <th className="py-2.5 pl-5 pr-5 font-semibold text-muted-foreground uppercase tracking-wider">
                Exame
              </th>
              <th className="w-[200px] py-2.5 px-5 font-semibold text-muted-foreground uppercase tracking-wider">
                Valor
              </th>
              <th className="w-[100px] py-2.5 px-5 font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="w-[80px] py-2.5 px-5 font-semibold text-muted-foreground uppercase tracking-wider text-right">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhum exame encontrado
                </td>
              </tr>
            )}
            {visible.map(row => {
              const semPreco = row.valor === null;
              const isEditing = editingExameId === row.exame.id;
              const destinoLabel = row.exame.tipoProcesso === "TERCEIRIZADO" ? "Apoio" : "Interno";
              return (
                <tr
                  key={row.exame.id}
                  className={`border-b border-border/40 hover:bg-muted/20 transition-colors h-11 ${
                    !row.ativo ? "opacity-50" : ""
                  }`}
                >
                  <td className="py-1.5 pl-5 pr-5 font-medium text-foreground align-middle">
                    <span className="block truncate" title={row.exame.nome}>
                      {row.exame.nome}
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">
                      <span className="font-mono">{row.codigoExibido}</span>
                      <span className="mx-1.5">·</span>
                      <span>{destinoLabel}</span>
                    </span>
                  </td>
                  <td className="py-0 px-5 align-middle">
                    {isEditing ? (
                      <div className="flex w-[160px] items-center gap-1">
                        <Input
                          className="rounded-lg h-7 w-[120px] text-xs"
                          type="number"
                          step="0.01"
                          min="0"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === "Enter") saveEdit(row);
                            if (e.key === "Escape") setEditingExameId(null);
                          }}
                        />
                        <button
                          onClick={() => saveEdit(row)}
                          className="p-1 rounded hover:bg-primary/10 text-primary"
                        >
                          <Save className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setEditingExameId(null)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : semPreco ? (
                      <button
                        onClick={() => startEdit(row)}
                        className="text-muted-foreground/60 italic hover:text-primary cursor-pointer"
                      >
                        — definir
                      </button>
                    ) : (
                      <span
                        className="font-semibold text-foreground cursor-pointer hover:text-primary"
                        onClick={() => startEdit(row)}
                      >
                        {formatCurrency(row.valor!)}
                      </span>
                    )}
                  </td>
                  <td className="py-0 px-5 align-middle">
                    {semPreco ? (
                      <span className="text-muted-foreground/60 italic">Sem preço</span>
                    ) : (
                      <button
                        onClick={() => handleToggle(row)}
                        className="flex items-center gap-1"
                      >
                        {row.ativo ? (
                          <>
                            <ToggleRight className="h-4 w-4 text-primary" />
                            <span className="text-primary font-medium">Ativo</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground font-medium">
                              Inativo
                            </span>
                          </>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-0 px-5 align-middle">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(row)}
                        className="p-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title={semPreco ? "Definir preço" : "Editar preço"}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      {!semPreco && (
                        <button
                          onClick={() => handleRemove(row)}
                          className="p-1 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                          title="Remover preço (exame continua no catálogo)"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {filtered.length > 0 && (
        <div className="px-5 py-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Exibindo{" "}
              <span className="font-semibold text-foreground">{showingFrom}</span>–
              <span className="font-semibold text-foreground">{showingTo}</span> de{" "}
              <span className="font-semibold text-foreground">{filtered.length}</span> exames
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Por página:</span>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}
                className="h-7 px-2 rounded-lg border border-border bg-background text-foreground text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PAGE_SIZE_OPTIONS.map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="h-7 w-7 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="px-2 text-foreground font-medium">
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="h-7 w-7 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center transition-colors"
                aria-label="Próxima página"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConvenioExamesPanel;
