import { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import { searchNormalize } from "@/lib/utils";
import { createPortal } from "react-dom";
import { DollarSign, Plus, Pencil, Trash2, Search, Power, Download, Upload, FileSpreadsheet, FileText, HelpCircle, AlertCircle, AlertTriangle } from "lucide-react";
import { getExamesCatalogoAtivos, type ExameCatalogo } from "@/data/exameCatalogoStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StandardDialog from "@/components/ui/standard-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
// XLSX é carregado dinamicamente em export/import para não inflar o chunk inicial.
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import { sanitizeTuss, validarTuss } from "@/lib/regulatorio";
import {
  type ItemTabelaPreco,
  type TabelaTipo,
  getItensByTabela,
  addItemTabelaPreco,
  updateItemTabelaPreco,
  removeItemTabelaPreco,
  toggleItemTabelaPreco,
} from "@/data/tabelaPrecoStore";
import SectionShell from "./_shared/SectionShell";
import Toolbar from "./_shared/Toolbar";
import EmptyState from "./_shared/EmptyState";

interface FormData {
  exameId: string;
  tabela: TabelaTipo;
  codigoExame: string;
  nomeExame: string;
  valor: number;
  porte: string;
  ativo: boolean;
}

const emptyForm = (tabela: TabelaTipo): FormData => ({
  exameId: "",
  tabela,
  codigoExame: "",
  nomeExame: "",
  valor: 0,
  porte: "-",
  ativo: true,
});

const tabelas: { id: TabelaTipo; label: string; desc: string }[] = [
  { id: "CBHPM", label: "CBHPM", desc: "Classificação Brasileira Hierarquizada de Procedimentos Médicos" },
  { id: "TUSS", label: "TUSS", desc: "Terminologia Unificada da Saúde Suplementar" },
  { id: "Própria", label: "Própria", desc: "Tabela de preços particular do laboratório" },
];

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TabelasPrecoTab = () => {
  const { toast } = useToast();
  const [activeTabela, setActiveTabela] = useState<TabelaTipo>("CBHPM");
  const [itens, setItens] = useState<ItemTabelaPreco[]>([]);
  const [search, setSearch] = useState("");
  const [onlyOrfaos, setOnlyOrfaos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<ItemTabelaPreco | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm(activeTabela));

  const reload = () => setItens(getItensByTabela(activeTabela));

  useEffect(() => {
    reload();
    setSearch("");
    setOnlyOrfaos(false);
  }, [activeTabela]);

  const orfaosCount = itens.filter(i => i.orfao).length;
  const filtered = itens.filter(i => {
    if (onlyOrfaos && !i.orfao) return false;
    const q = searchNormalize(search);
    if (!q) return true;
    return (
      searchNormalize(i.nomeExame).includes(q) ||
      searchNormalize(i.codigoExame).includes(q) ||
      (i.orfao && searchNormalize(i.exameId).includes(q))
    );
  });

  const handleNovo = () => {
    setEditando(null);
    setForm(emptyForm(activeTabela));
    setDialogOpen(true);
  };

  const handleEditar = (item: ItemTabelaPreco) => {
    setEditando(item);
    setForm({
      exameId: item.exameId,
      tabela: item.tabela,
      codigoExame: item.codigoExame,
      nomeExame: item.nomeExame,
      valor: item.valor,
      porte: item.porte,
      ativo: item.ativo,
    });
    setDialogOpen(true);
  };

  const handleRemover = async (id: number) => {
    const ok = await removeItemTabelaPreco(id);
    reload();
    toast({
      title: ok ? "Item removido da tabela" : "Falha ao remover",
      variant: ok ? undefined : "destructive",
    });
  };

  const handleToggle = async (id: number) => {
    const ok = await toggleItemTabelaPreco(id);
    reload();
    if (!ok) toast({ title: "Falha ao alterar status", variant: "destructive" });
  };

  const handleSalvar = async () => {
    if (!form.nomeExame.trim() || !form.exameId) {
      toast({ title: "Selecione um exame do catálogo", variant: "destructive" });
      return;
    }
    if (form.tabela === "TUSS") {
      const check = validarTuss(form.codigoExame);
      if (!check.ok) {
        toast({ title: "Código TUSS inválido", description: check.mensagem, variant: "destructive" });
        return;
      }
    }
    if (editando) {
      const ok = await updateItemTabelaPreco(editando.id, { valor: form.valor, ativo: form.ativo });
      if (!ok) { toast({ title: "Falha ao atualizar preço", variant: "destructive" }); return; }
      toast({ title: "Preço atualizado" });
    } else {
      const result = await addItemTabelaPreco({ exameId: form.exameId, tabela: form.tabela, valor: form.valor, ativo: form.ativo });
      if (!result) { toast({ title: "Falha ao adicionar (verifique se já existe ou erro de servidor)", variant: "destructive" }); return; }
      toast({ title: "Exame adicionado à tabela" });
    }
    reload();
    setDialogOpen(false);
  };

  const totalAtivos = itens.filter(i => i.ativo).length;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const exportData = async (format: "pdf" | "excel") => {
    const data = filtered.map(i => ({
      Código: i.codigoExame,
      Exame: i.nomeExame,
      ...(activeTabela === "CBHPM" ? { Porte: i.porte } : {}),
      Valor: i.valor,
      Status: i.ativo ? "Ativo" : "Inativo",
    }));

    if (format === "excel") {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeTabela);
      XLSX.writeFile(wb, `tabela_${activeTabela.toLowerCase()}.xlsx`);
      toast({ title: `Tabela ${activeTabela} exportada em Excel` });
    } else {
      const cols = Object.keys(data[0] || {});
      const rows = data.map(d => `<tr>${cols.map(c => `<td style="padding:6px 12px;border:1px solid #ddd">${d[c as keyof typeof d]}</td>`).join("")}</tr>`).join("");
      const html = `<html><head><title>Tabela ${activeTabela}</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th{background:#f3f4f6;padding:8px 12px;border:1px solid #ddd;text-align:left;font-size:12px}td{font-size:12px}</style></head><body><h2>Tabela de Preços — ${activeTabela}</h2><table><thead><tr>${cols.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
      printHtmlInHiddenFrame({ html, frameId: `tabela-${activeTabela}-print-frame` });
      toast({ title: `Tabela ${activeTabela} exportada em PDF` });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws);
        const existingItens = getItensByTabela(activeTabela);
        let count = 0;
        let skipped = 0;
        let failed = 0;
        for (const row of rows) {
          const nome = String(row["Exame"] || row["nomeExame"] || "").trim();
          const valor = parseFloat(String(row["Valor"] || row["valor"] || "0")) || 0;
          const porte = String(row["Porte"] || row["porte"] || "-").trim();
          if (!nome) continue;
          const exame = getExamesCatalogoAtivos().find(e => e.nome.toLowerCase() === nome.toLowerCase());
          if (!exame) { skipped++; continue; }
          const duplicate = existingItens.some(i => i.exameId === exame.id);
          if (duplicate) { skipped++; continue; }
          const r = await addItemTabelaPreco({ exameId: exame.id, tabela: activeTabela, valor, ativo: true });
          if (r) count++; else failed++;
        }
        reload();
        const parts: string[] = [`${count} importados`];
        if (skipped) parts.push(`${skipped} ignorados`);
        if (failed) parts.push(`${failed} falharam`);
        toast({ title: parts.join(", "), variant: failed > 0 ? "destructive" : undefined });
      } catch {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const tabelaAtual = tabelas.find(t => t.id === activeTabela);

  const tabelaPills = (
    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted">
      {tabelas.map(t => {
        const active = activeTabela === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setActiveTabela(t.id)}
            className={`h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <SectionShell
      icon={<DollarSign className="h-5 w-5 text-primary" />}
      title="Tabelas de Preço"
      description="Gerencie os valores praticados nas tabelas CBHPM, TUSS e Própria"
      actions={
        <>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" className="rounded-xl text-xs h-9 gap-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Importar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="rounded-xl text-xs h-9 gap-2">
                <Download className="h-3.5 w-3.5" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => exportData("pdf")} className="gap-2 text-xs">
                <FileText className="h-3.5 w-3.5" /> Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportData("excel")} className="gap-2 text-xs">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="rounded-xl text-xs h-9 gap-2" onClick={handleNovo}>
            <Plus className="h-3.5 w-3.5" /> Novo item
          </Button>
        </>
      }
      toolbar={
        <Toolbar
          leading={tabelaPills}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar por nome ou código..."
          trailing={
            <div className="flex items-center gap-2">
              {orfaosCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyOrfaos(v => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-semibold transition-colors border ${
                    onlyOrfaos
                      ? "bg-destructive/10 border-destructive/40 text-destructive"
                      : "bg-muted border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  title="Filtrar linhas com exame_id órfão (sem correspondência no catálogo)"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {orfaosCount} órfão{orfaosCount > 1 ? "s" : ""}
                  {onlyOrfaos && <span className="opacity-70">· limpar</span>}
                </button>
              )}
              <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
                {totalAtivos}/{itens.length} ativos
              </span>
            </div>
          }
        />
      }
      banner={
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{tabelaAtual?.label}</span> · {tabelaAtual?.desc}
        </p>
      }
      bodyless
    >
      {filtered.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="Nenhum item nesta tabela"
          description={search ? "Ajuste a busca para tentar novamente." : `Adicione o primeiro item à tabela ${activeTabela}.`}
        />
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-muted/20">
                  <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Código</th>
                  <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Exame</th>
                  {activeTabela === "CBHPM" && (
                    <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                      <div className="flex items-center gap-1.5 group relative">
                        Porte
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                        <div className="invisible group-hover:visible absolute left-0 top-full mt-2 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg p-3 text-xs text-foreground font-normal normal-case tracking-normal">
                          <p className="font-bold mb-2 text-sm">Classificação de Porte CBHPM</p>
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="font-medium">1A</span><span className="text-muted-foreground">Muito simples (Glicemia, Ureia)</span></div>
                            <div className="flex justify-between"><span className="font-medium">1B</span><span className="text-muted-foreground">Simples (Colesterol, Triglicerídeos)</span></div>
                            <div className="flex justify-between"><span className="font-medium">1C</span><span className="text-muted-foreground">Baixa complexidade (Hemograma)</span></div>
                            <div className="flex justify-between"><span className="font-medium">2A</span><span className="text-muted-foreground">Média complexidade (TSH, PSA)</span></div>
                            <div className="flex justify-between"><span className="font-medium">2B+</span><span className="text-muted-foreground">Complexidade crescente</span></div>
                          </div>
                          <p className="mt-2 text-muted-foreground">Indica a complexidade técnica do procedimento conforme a AMB/CBHPM.</p>
                        </div>
                      </div>
                    </th>
                  )}
                  <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider text-right">Valor</th>
                  <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Status</th>
                  <th className="py-3 px-5 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${!item.ativo ? "opacity-60" : ""} ${item.orfao ? "bg-destructive/5" : ""}`}>
                    <td className="py-3 px-5 font-mono text-xs text-muted-foreground">{item.codigoExame || "—"}</td>
                    <td className="py-3 px-5 font-medium text-foreground">
                      {item.orfao ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1.5 text-destructive font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {item.nomeExame}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">exame_id: {item.exameId || "—"}</span>
                        </div>
                      ) : (
                        item.nomeExame
                      )}
                    </td>
                    {activeTabela === "CBHPM" && (
                      <td className="py-3 px-5">
                        <span className="px-2 py-0.5 rounded-md bg-accent text-accent-foreground text-xs font-medium">{item.porte}</span>
                      </td>
                    )}
                    <td className="py-3 px-5 font-semibold text-foreground text-right tabular-nums">{formatCurrency(item.valor)}</td>
                    <td className="py-3 px-5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${item.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEditar(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleToggle(item.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={item.ativo ? "Desativar" : "Ativar"}>
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleRemover(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive" title="Remover">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Cards */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map(item => (
              <div key={item.id} className={`px-5 py-3 ${!item.ativo ? "opacity-60" : ""} ${item.orfao ? "bg-destructive/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {item.orfao && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-semibold">
                          <AlertTriangle className="h-3 w-3" /> Órfão
                        </span>
                      )}
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${item.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                      {activeTabela === "CBHPM" && item.porte !== "-" && (
                        <span className="px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground text-[10px] font-semibold">Porte {item.porte}</span>
                      )}
                      {item.codigoExame && (
                        <span className="font-mono text-[10px] text-muted-foreground">{item.codigoExame}</span>
                      )}
                    </div>
                    <p className={`font-semibold text-sm truncate ${item.orfao ? "text-destructive" : "text-foreground"}`}>{item.nomeExame}</p>
                    <p className="font-bold text-primary text-sm tabular-nums mt-1">{formatCurrency(item.valor)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => handleEditar(item)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => handleToggle(item.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><Power className="h-4 w-4" /></button>
                    <button onClick={() => handleRemover(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Dialog */}
      <StandardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={<DollarSign className="h-5 w-5 text-primary" />}
        title={`${editando ? "Editar item" : "Novo item"} — ${activeTabela}`}
        subtitle="Dados do exame na tabela de preços"
        maxWidth="lg"
        footer={
          <>
            <button onClick={() => setDialogOpen(false)} className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all">Cancelar</button>
            <button onClick={handleSalvar} className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm">
              {editando ? "Atualizar" : "Adicionar"}
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Código {form.tabela === "TUSS" && <span className="text-muted-foreground/60 normal-case font-normal tracking-normal">(8 dígitos)</span>}
              </label>
              <Input
                className={`rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40 ${
                  form.tabela === "TUSS" && form.codigoExame && !validarTuss(form.codigoExame).ok ? "border-destructive/60" : ""
                }`}
                inputMode={form.tabela === "TUSS" ? "numeric" : "text"}
                maxLength={form.tabela === "TUSS" ? 8 : undefined}
                value={form.codigoExame}
                onChange={e => {
                  const v = form.tabela === "TUSS" ? sanitizeTuss(e.target.value) : e.target.value;
                  setForm(f => ({ ...f, codigoExame: v }));
                }}
                placeholder="40301630"
              />
              {form.tabela === "TUSS" && form.codigoExame && !validarTuss(form.codigoExame).ok && (
                <p className="flex items-center gap-1 text-[10px] text-destructive">
                  <AlertCircle className="h-3 w-3" /> Deve ter exatamente 8 dígitos.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tabela</label>
              <Select value={form.tabela} onValueChange={v => setForm(f => ({ ...f, tabela: v as TabelaTipo }))}>
                <SelectTrigger className="rounded-2xl h-10 text-sm border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBHPM">CBHPM</SelectItem>
                  <SelectItem value="TUSS">TUSS</SelectItem>
                  <SelectItem value="Própria">Própria</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ExameAutocomplete
            value={form.nomeExame}
            onChange={(nome) => setForm(f => ({ ...f, nomeExame: nome, exameId: "" }))}
            onSelect={(exame) => {
              const tabelaItem = getItensByTabela(activeTabela).find(i => i.exameId === exame.id);
              setForm(f => ({
                ...f,
                exameId: exame.id,
                nomeExame: exame.nome,
                codigoExame: activeTabela === "CBHPM" ? exame.codigoCBHPM : activeTabela === "TUSS" ? exame.codigoTUSS : exame.mnemonico,
                porte: exame.porteCBHPM || f.porte,
                valor: tabelaItem?.valor ?? f.valor,
              }));
            }}
          />

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor (R$)</label>
            <Input className="rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40" type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))} placeholder="0.00" />
            {form.porte && form.porte !== "-" && form.tabela === "CBHPM" && (
              <p className="text-[11px] text-muted-foreground">Porte CBHPM do catálogo: <span className="font-semibold text-foreground">{form.porte}</span></p>
            )}
          </div>
        </div>
      </StandardDialog>
    </SectionShell>
  );
};

/* ---- Autocomplete inline para buscar exames do catálogo ---- */

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface ExameAutoProps {
  value: string;
  onChange: (v: string) => void;
  onSelect: (e: ExameCatalogo) => void;
}

const ExameAutocomplete = ({ value, onChange, onSelect }: ExameAutoProps) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = inputWrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const results = useMemo(() => {
    const q = normalize(value);
    if (!q) return getExamesCatalogoAtivos();
    return getExamesCatalogoAtivos().filter(e =>
      normalize(e.nome).includes(q) || normalize(e.mnemonico).includes(q) || e.codigoCBHPM.includes(value)
    );
  }, [value]);

  return (
    <div className="space-y-1.5 relative" ref={ref}>
      <Label className="text-xs text-muted-foreground">Nome do exame</Label>
      <div className="relative" ref={inputWrapRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="rounded-xl h-9 text-sm pl-9"
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar exame..."
        />
      </div>
      {open && position &&
        createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: 9999,
            }}
            className="bg-popover border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto"
          >
            {results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground text-center">Nenhum exame encontrado</div>
            ) : (
              results.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onMouseDown={(ev) => { ev.preventDefault(); onSelect(e); setOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-foreground">{e.nome}</span>
                  <span className="text-xs text-muted-foreground font-mono">{e.mnemonico}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default TabelasPrecoTab;
