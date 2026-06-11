import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Plus,
  Pencil,
  Trash2,
  Lock,
  Power,
  Search,
  Star,
  ChevronRight,
  ArrowLeft,
  CalendarClock,
  Tag,
  FileSpreadsheet,
  Unlock,
  Receipt,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StandardDialog from "@/components/ui/standard-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type Convenio,
  getConvenios,
  addConvenio,
  updateConvenio,
  removeConvenio,
  toggleConvenio,
  isParticular,
} from "@/data/convenioStore";
import { getCoberturaTabela, subscribeTabelaPreco } from "@/data/tabelaPrecoStore";
import { subscribeExamesCatalogo } from "@/data/exameCatalogoStore";
import ConvenioExamesPanel from "./ConvenioExamesPanel";
import SectionShell from "./_shared/SectionShell";
import EmptyState from "./_shared/EmptyState";

type FormData = Omit<Convenio, "id">;

const emptyForm: FormData = {
  nome: "",
  registroANS: "",
  tipo: "Saúde",
  tabela: "CBHPM",
  diasRetorno: 30,
  ativo: true,
  liberaFluxoSemPagamento: false,
  prazoFaturamentoDias: 30,
};

const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const ConveniosTab = () => {
  const { toast } = useToast();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Convenio | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [tickPreco, setTickPreco] = useState(0);

  useEffect(() => {
    setConvenios(getConvenios());
    const unsubP = subscribeTabelaPreco(() => setTickPreco(t => t + 1));
    const unsubE = subscribeExamesCatalogo(() => setTickPreco(t => t + 1));
    return () => { unsubP(); unsubE(); };
  }, []);

  // Cobertura por tabela
  const coberturaPorTabela = useMemo(() => {
    const tabelas = ["CBHPM", "TUSS", "Própria"] as const;
    const map: Record<string, { total: number; precificados: number }> = {};
    tabelas.forEach(t => { map[t] = getCoberturaTabela(t); });
    return map;
  }, [tickPreco]);

  // Particular sempre primeiro, depois ativos, depois inativos, ordem alfabética
  const sorted = useMemo(() => {
    return [...convenios].sort((a, b) => {
      if (isParticular(a)) return -1;
      if (isParticular(b)) return 1;
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      return a.nome.localeCompare(b.nome);
    });
  }, [convenios]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return sorted;
    return sorted.filter(c =>
      normalize(c.nome).includes(q) || c.registroANS.includes(search)
    );
  }, [sorted, search]);

  const selected = useMemo(
    () => convenios.find(c => c.id === selectedId) ?? null,
    [convenios, selectedId],
  );

  const handleNovo = () => {
    setEditando(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEditar = (conv: Convenio) => {
    setEditando(conv);
    const { id, ...rest } = conv;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleRemover = async (id: number) => {
    const conv = convenios.find(c => c.id === id);
    if (conv && isParticular(conv)) {
      toast({ title: "O convênio Particular não pode ser removido", variant: "destructive" });
      return;
    }
    const ok = await removeConvenio(id);
    if (!ok) { toast({ title: "Falha ao remover convênio", description: "Convênios padrão do sistema não podem ser removidos.", variant: "destructive" }); return; }
    const novos = getConvenios();
    setConvenios(novos);
    if (selectedId === id) {
      setSelectedId(novos.find(isParticular)?.id ?? novos[0]?.id ?? null);
    }
    toast({ title: "Convênio removido" });
  };

  const handleToggle = async (id: number) => {
    const conv = convenios.find(c => c.id === id);
    if (conv && isParticular(conv)) {
      toast({ title: "O convênio Particular está sempre ativo", variant: "destructive" });
      return;
    }
    const ok = await toggleConvenio(id);
    if (!ok) { toast({ title: "Falha ao alterar status", variant: "destructive" }); return; }
    setConvenios(getConvenios());
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome do convênio", variant: "destructive" });
      return;
    }
    if (editando) {
      const ok = await updateConvenio(editando.id, form);
      if (!ok) { toast({ title: "Falha ao atualizar convênio", variant: "destructive" }); return; }
      toast({ title: "Convênio atualizado" });
    } else {
      const created = await addConvenio(form);
      if (!created) { toast({ title: "Falha ao cadastrar convênio", variant: "destructive" }); return; }
      toast({ title: "Convênio cadastrado" });
    }
    setConvenios(getConvenios());
    setDialogOpen(false);
  };

  const ativos = convenios.filter(c => c.ativo).length;

  const renderCobertura = (tabela: string, size: "sm" | "md" = "sm") => {
    const cob = coberturaPorTabela[tabela];
    if (!cob || cob.total === 0) return null;
    const pct = Math.round((cob.precificados / cob.total) * 100);
    const cor =
      pct === 100
        ? "bg-success/10 text-success"
        : pct >= 50
          ? "bg-warning/10 text-warning"
          : "bg-destructive/10 text-destructive";
    const cls = size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";
    return (
      <span
        className={`${cls} rounded-md font-semibold ${cor}`}
        title={`${cob.precificados} de ${cob.total} exames com preço definido (${pct}%)`}
      >
        {cob.precificados}/{cob.total}
      </span>
    );
  };

  // ===== Vista de DETALHE (página dedicada) =====
  if (selected) {
    return (
      <>
        <SectionShell
          icon={
            isParticular(selected)
              ? <Star className="h-5 w-5 text-primary" />
              : <CreditCard className="h-5 w-5 text-primary" />
          }
          title={selected.nome}
          description={
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" /> {selected.tipo}
              </span>
              <span className="font-mono">ANS: {selected.registroANS || "—"}</span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3" />
                {selected.diasRetorno > 0 ? `${selected.diasRetorno}d retorno` : "Sem prazo"}
              </span>
            </span>
          }
          meta={
            <div className="flex items-center gap-1.5">
              {isParticular(selected) && (
                <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase">
                  Padrão
                </span>
              )}
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  selected.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                {selected.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
          }
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedId(null)}
                className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar
              </button>
              <button
                onClick={() => handleEditar(selected)}
                className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
              {!isParticular(selected) && (
                <>
                  <button
                    onClick={() => handleToggle(selected.id)}
                    className="h-9 px-3 rounded-xl border border-border bg-background hover:bg-muted text-xs font-medium text-foreground inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Power className="h-3.5 w-3.5" />
                    {selected.ativo ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleRemover(selected.id)}
                    className="h-9 w-9 rounded-xl border border-border bg-background hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive text-muted-foreground inline-flex items-center justify-center transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          }
          bodyless
        >
          {/* Cards-resumo */}
          <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-3 gap-3 border-b border-border">
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Tabela vinculada
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                  {selected.tabela}
                </span>
                {isParticular(selected) && <Lock className="h-3 w-3 text-muted-foreground" />}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Cobertura de preços
              </div>
              <div className="mt-1 flex items-center gap-2">
                {renderCobertura(selected.tabela, "md") ?? (
                  <span className="text-xs text-muted-foreground">Sem dados</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-background px-3 py-2.5 col-span-2 lg:col-span-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Tipo de plano
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">{selected.tipo}</span>
              </div>
            </div>
          </div>

          {/* Painel de exames */}
          <div>
            <ConvenioExamesPanel convenioNome={selected.nome} tabela={selected.tabela} />
          </div>
        </SectionShell>

        {renderDialog()}
      </>
    );
  }

  // ===== Vista de LISTA =====
  return (
    <>
      <SectionShell
        icon={<CreditCard className="h-5 w-5 text-primary" />}
        title="Convênios"
        description="Gerencie os convênios e as tabelas de preço aplicadas no laboratório"
        meta={
          <span className="px-2.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-semibold">
            {ativos}/{convenios.length} ativos
          </span>
        }
        actions={
          <Button className="rounded-xl text-xs h-9 gap-2" onClick={handleNovo}>
            <Plus className="h-3.5 w-3.5" />
            Novo convênio
          </Button>
        }
        toolbar={
          <div className="px-5 py-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 rounded-xl text-sm"
                placeholder="Buscar convênio ou registro ANS..."
              />
            </div>
          </div>
        }
        bodyless
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="Nenhum convênio encontrado"
            description={search ? "Ajuste a busca para tentar novamente." : "Cadastre o primeiro convênio para começar."}
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map(conv => {
              const particular = isParticular(conv);
              return (
                <li key={conv.id}>
                  <button
                    onClick={() => setSelectedId(conv.id)}
                    className={`w-full text-left px-5 py-4 flex items-center gap-4 transition-colors group hover:bg-muted/30 ${
                      !conv.ativo ? "opacity-60" : ""
                    }`}
                  >
                    <div
                      className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                        particular
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors"
                      }`}
                    >
                      {particular ? <Star className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{conv.nome}</span>
                        {particular && (
                          <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[9px] font-bold uppercase tracking-wide">
                            Padrão
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                            conv.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {conv.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
                            {conv.tabela}
                          </span>
                          {renderCobertura(conv.tabela)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" /> {conv.tipo}
                        </span>
                        {conv.registroANS && <span className="font-mono">ANS {conv.registroANS}</span>}
                        {conv.diasRetorno > 0 && (
                          <span className="flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            {conv.diasRetorno}d
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </SectionShell>

      {renderDialog()}
    </>
  );

  // ===== Dialog (compartilhado) =====
  function renderDialog() {
    return (
      <StandardDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        icon={<CreditCard className="h-5 w-5 text-primary" />}
        title={editando ? "Editar convênio" : "Novo convênio"}
        subtitle="Dados do plano de saúde"
        maxWidth="lg"
        footer={
          <>
            <button
              onClick={() => setDialogOpen(false)}
              className="h-11 px-6 rounded-2xl border border-border/60 bg-background text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold hover:opacity-90 transition-all shadow-sm"
            >
              {editando ? "Atualizar" : "Cadastrar"}
            </button>
          </>
        }
      >
        <div className="px-6 py-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Nome do convênio
            </label>
            <Input
              className="rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Unimed"
              disabled={editando ? isParticular(editando) : false}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Registro ANS
              </label>
              <Input
                className="rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                value={form.registroANS}
                onChange={e => setForm(f => ({ ...f, registroANS: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                placeholder="000000"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Tipo
              </label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as Convenio["tipo"] }))}>
                <SelectTrigger className="rounded-2xl h-10 text-sm border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Saúde">Saúde</SelectItem>
                  <SelectItem value="Odontológico">Odontológico</SelectItem>
                  <SelectItem value="Ocupacional">Ocupacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                Tabela de preços
                {editando && isParticular(editando) && <Lock className="h-2.5 w-2.5" />}
              </label>
              {editando && isParticular(editando) ? (
                <div className="rounded-2xl h-10 px-3 flex items-center text-sm border border-border/60 bg-muted/30 text-muted-foreground gap-2">
                  <span className="font-medium text-foreground">Própria</span>
                  <span className="text-[10px]">(vinculada automaticamente ao convênio Particular)</span>
                </div>
              ) : (
                <Select value={form.tabela} onValueChange={v => setForm(f => ({ ...f, tabela: v }))}>
                  <SelectTrigger className="rounded-2xl h-10 text-sm border-border/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CBHPM">CBHPM</SelectItem>
                    <SelectItem value="TUSS">TUSS</SelectItem>
                    <SelectItem value="Própria">Própria</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Dias para retorno
              </label>
              <Input
                className="rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                type="number"
                value={form.diasRetorno}
                onChange={e => setForm(f => ({ ...f, diasRetorno: parseInt(e.target.value) || 0 }))}
                placeholder="30"
              />
            </div>
          </div>

          {/* Cobrança / Faturamento */}
          {!(editando && isParticular(editando)) && (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                  Cobrança e faturamento
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl bg-background border border-border/60 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                    Liberar fluxo sem pagamento
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Se ativo, exames cobrados deste convênio liberam coleta, análise e resultado mesmo sem pagamento do paciente.
                  </p>
                </div>
                <Switch
                  checked={form.liberaFluxoSemPagamento}
                  onCheckedChange={v => setForm(f => ({ ...f, liberaFluxoSemPagamento: v }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Prazo de faturamento (dias)
                </label>
                <Input
                  className="rounded-2xl h-10 text-sm border-border/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  type="number"
                  min={1}
                  value={form.prazoFaturamentoDias}
                  onChange={e => setForm(f => ({ ...f, prazoFaturamentoDias: Math.max(1, parseInt(e.target.value) || 0) }))}
                  placeholder="30"
                />
                <p className="text-[10px] text-muted-foreground">
                  Janela padrão para fechar a fatura agrupada deste convênio.
                </p>
              </div>
            </div>
          )}
        </div>
      </StandardDialog>
    );
  }
};

export default ConveniosTab;
