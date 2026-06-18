// Visão "Por filtro" (master-detail) para Valores de Referência.
// LEFT: lista de filtros distintos (sexo + faixa etária) com contagem de parâmetros.
// RIGHT: tabela editável dos parâmetros do filtro selecionado.
// Foco: localizar e editar rapidamente "Masculino · 0d–3m" sem percorrer a matriz inteira.

import { useEffect, useMemo, useState } from "react";
import { User, UserRound, Users, Plus, Trash2, Search, Filter as FilterIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type ValorReferencia, addValorReferencia, removeValorReferencia, updateValorReferencia,
} from "@/data/valoresReferenciaStore";
import { formatFaixaIdade, idadeParaDias } from "@/lib/idadeFormat";

interface Props {
  exameNome: string;
  parametros: string[];               // rótulos dos parâmetros do exame (catálogo)
  referencias: ValorReferencia[];     // VRs já carregados desse exame
  onMutate: () => void;
}

type Sexo = "Masculino" | "Feminino" | "Ambos";
const SEXO_ICON = (s: Sexo) =>
  s === "Masculino" ? <User className="h-3.5 w-3.5" /> :
  s === "Feminino"  ? <UserRound className="h-3.5 w-3.5" /> :
                      <Users className="h-3.5 w-3.5" />;

interface FiltroKey {
  id: string;                   // chave estável
  sexo: Sexo;
  idadeMin: string;
  idadeMax: string;
  unidadeIdade: ValorReferencia["unidadeIdade"];
  diasMin: number;
  diasMax: number;
}

const keyOf = (r: { sexo: string; idadeMin: string; idadeMax: string; unidadeIdade: string }) =>
  `${r.sexo}|${r.idadeMin}|${r.idadeMax}|${r.unidadeIdade}`;

const FiltrosPorPerfil = ({ exameNome, parametros, referencias, onMutate }: Props) => {
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [novoParam, setNovoParam] = useState<string>("");
  const [draft, setDraft] = useState<Record<number, { min: string; max: string; descricao: string; unidade: string }>>({});

  // Filtros distintos derivados dos VRs.
  const filtros = useMemo<FiltroKey[]>(() => {
    const map = new Map<string, FiltroKey>();
    for (const r of referencias) {
      const k = keyOf(r);
      if (map.has(k)) continue;
      map.set(k, {
        id: k,
        sexo: r.sexo as Sexo,
        idadeMin: r.idadeMin,
        idadeMax: r.idadeMax,
        unidadeIdade: r.unidadeIdade,
        diasMin: idadeParaDias(r.idadeMin || "0", r.unidadeIdade),
        diasMax: idadeParaDias(r.idadeMax || "999", r.unidadeIdade),
      });
    }
    const arr = Array.from(map.values());
    // Ordena: Masculino → Feminino → Ambos; dentro do sexo, por idade crescente.
    const sexoOrder: Record<Sexo, number> = { Masculino: 0, Feminino: 1, Ambos: 2 };
    arr.sort((a, b) =>
      sexoOrder[a.sexo] - sexoOrder[b.sexo] ||
      a.diasMin - b.diasMin ||
      a.diasMax - b.diasMax,
    );
    return arr;
  }, [referencias]);

  // Mantém uma seleção válida quando os filtros mudam.
  useEffect(() => {
    if (filtros.length === 0) { setSelecionado(null); return; }
    if (!selecionado || !filtros.some((f) => f.id === selecionado)) {
      setSelecionado(filtros[0].id);
    }
  }, [filtros, selecionado]);

  const filtrosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return filtros;
    return filtros.filter((f) => {
      const label = `${f.sexo} ${formatFaixaIdade(f.idadeMin, f.idadeMax, f.unidadeIdade)}`.toLowerCase();
      return label.includes(q);
    });
  }, [filtros, busca]);

  const filtroAtivo = useMemo(
    () => filtros.find((f) => f.id === selecionado) ?? null,
    [filtros, selecionado],
  );

  // Índice por nome (case-insensitive) para ordenar conforme o Layout Científico.
  // `parametros` já chega na ordem do layout/catálogo; usamos isso como referência.
  const ordemPorNome = useMemo(() => {
    const m = new Map<string, number>();
    parametros.forEach((p, i) => m.set(p.trim().toLowerCase(), i));
    return m;
  }, [parametros]);

  // VRs do filtro selecionado, ordenados conforme o Layout Científico.
  const vrsDoFiltro = useMemo(() => {
    if (!filtroAtivo) return [] as ValorReferencia[];
    const idx = (nome: string) => {
      const i = ordemPorNome.get(nome.trim().toLowerCase());
      return i === undefined ? Number.MAX_SAFE_INTEGER : i;
    };
    return referencias
      .filter((r) => keyOf(r) === filtroAtivo.id)
      .sort((a, b) => {
        const ia = idx(a.parametroNome);
        const ib = idx(b.parametroNome);
        if (ia !== ib) return ia - ib;
        return a.parametroNome.localeCompare(b.parametroNome, "pt-BR");
      });
  }, [referencias, filtroAtivo, ordemPorNome]);

  // Quantos parâmetros cada filtro tem (para exibir badge).
  const countByFiltro = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of referencias) c[keyOf(r)] = (c[keyOf(r)] || 0) + 1;
    return c;
  }, [referencias]);

  // Parâmetros do catálogo que AINDA não foram cadastrados nesse filtro.
  const parametrosFaltantes = useMemo(() => {
    if (!filtroAtivo) return [] as string[];
    const usados = new Set(vrsDoFiltro.map((r) => r.parametroNome.toLowerCase()));
    return parametros.filter((p) => !usados.has(p.toLowerCase()));
  }, [parametros, vrsDoFiltro, filtroAtivo]);

  const getDraft = (r: ValorReferencia) => draft[r.id] ?? {
    min: r.valorMin, max: r.valorMax, descricao: r.descricao || "", unidade: r.unidade,
  };

  const patchDraft = (id: number, patch: Partial<{ min: string; max: string; descricao: string; unidade: string }>) => {
    setDraft((d) => ({ ...d, [id]: { ...(d[id] ?? { min: "", max: "", descricao: "", unidade: "" }), ...patch } }));
  };

  const persist = async (r: ValorReferencia) => {
    const d = draft[r.id];
    if (!d) return;
    const changed = d.min !== r.valorMin || d.max !== r.valorMax || d.descricao !== (r.descricao || "") || d.unidade !== r.unidade;
    if (!changed) { setDraft((x) => { const c = { ...x }; delete c[r.id]; return c; }); return; }
    const ok = await updateValorReferencia(r.id, {
      ...r,
      valorMin: d.min.trim(),
      valorMax: d.max.trim(),
      descricao: d.descricao.trim(),
      unidade: d.unidade.trim(),
    });
    if (!ok) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    setDraft((x) => { const c = { ...x }; delete c[r.id]; return c; });
    onMutate();
  };

  const remover = async (r: ValorReferencia) => {
    const ok = await removeValorReferencia(r.id);
    if (!ok) { toast({ title: "Erro ao remover", variant: "destructive" }); return; }
    toast({ title: "Parâmetro removido deste filtro" });
    onMutate();
  };

  const adicionarParametro = async () => {
    if (!filtroAtivo || !novoParam) return;
    const novo = await addValorReferencia({
      exameNome,
      parametroNome: novoParam,
      sexo: filtroAtivo.sexo,
      idadeMin: filtroAtivo.idadeMin,
      idadeMax: filtroAtivo.idadeMax,
      unidadeIdade: filtroAtivo.unidadeIdade,
      valorMin: "",
      valorMax: "",
      unidade: "",
      descricao: "",
    });
    if (!novo) { toast({ title: "Erro ao adicionar", variant: "destructive" }); return; }
    setNovoParam("");
    onMutate();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 min-h-[480px]">
      {/* ───── LEFT: Filtros ───── */}
      <aside className="rounded-2xl border border-border/40 bg-muted/10 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-border/30 space-y-2 bg-background/50">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <FilterIcon className="h-3 w-3" /> Filtros ({filtros.length})
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              className="rounded-lg h-8 text-[12px] pl-7 bg-background border-border/60"
              placeholder="Buscar (ex.: M 3m)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto p-1.5 space-y-0.5 no-scrollbar">
          {filtrosFiltrados.length === 0 && (
            <li className="px-3 py-6 text-center text-[12px] text-muted-foreground">
              Nenhum filtro cadastrado ainda.
            </li>
          )}
          {filtrosFiltrados.map((f) => {
            const ativo = f.id === selecionado;
            return (
              <li key={f.id}>
                <button
                  onClick={() => setSelecionado(f.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg transition-all border ${
                    ativo
                      ? "bg-primary/8 border-primary/30 text-foreground"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`shrink-0 ${ativo ? "text-primary" : ""}`}>{SEXO_ICON(f.sexo)}</span>
                      <span className="text-[12px] font-medium truncate">{f.sexo}</span>
                    </div>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-md ${
                      ativo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {countByFiltro[f.id] ?? 0}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 pl-5 truncate">
                    {formatFaixaIdade(f.idadeMin, f.idadeMax, f.unidadeIdade)}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ───── RIGHT: Parâmetros do filtro selecionado ───── */}
      <section className="rounded-2xl border border-border/40 bg-background overflow-hidden flex flex-col">
        {!filtroAtivo ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-muted-foreground p-8">
            Selecione um filtro à esquerda para editar seus parâmetros.
          </div>
        ) : (
          <>
            {/* Header do filtro ativo */}
            <header className="px-4 py-3 border-b border-border/30 bg-muted/20 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-primary">{SEXO_ICON(filtroAtivo.sexo)}</span>
                <h3 className="text-[14px] font-semibold text-foreground">{filtroAtivo.sexo}</h3>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-[13px] text-muted-foreground">
                  {formatFaixaIdade(filtroAtivo.idadeMin, filtroAtivo.idadeMax, filtroAtivo.unidadeIdade)}
                </span>
              </div>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {vrsDoFiltro.length} parâmetro(s)
              </span>
            </header>

            {/* Tabela editável */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/30 z-10">
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Parâmetro</th>
                    <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">Mín</th>
                    <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">Máx</th>
                    <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-28">Unidade</th>
                    <th className="text-left py-2 px-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Texto p/ laudo</th>
                    <th className="py-2 px-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {vrsDoFiltro.map((r) => {
                    const d = getDraft(r);
                    return (
                      <tr key={r.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                        <td className="py-1.5 px-3 text-[13px] font-medium text-foreground whitespace-nowrap">{r.parametroNome}</td>
                        <td className="py-1.5 px-2">
                          <Input
                            className="rounded-md h-8 text-[12px] bg-muted/30 border-border/60 text-center"
                            value={d.min}
                            placeholder="—"
                            onChange={(e) => patchDraft(r.id, { min: e.target.value })}
                            onBlur={() => persist(r)}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            className="rounded-md h-8 text-[12px] bg-muted/30 border-border/60 text-center"
                            value={d.max}
                            placeholder="—"
                            onChange={(e) => patchDraft(r.id, { max: e.target.value })}
                            onBlur={() => persist(r)}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            className="rounded-md h-8 text-[12px] bg-muted/30 border-border/60"
                            value={d.unidade}
                            placeholder="—"
                            onChange={(e) => patchDraft(r.id, { unidade: e.target.value })}
                            onBlur={() => persist(r)}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <Input
                            className="rounded-md h-8 text-[12px] bg-muted/20 border-border/40"
                            value={d.descricao}
                            placeholder="Opcional (substitui min–max no laudo)"
                            onChange={(e) => patchDraft(r.id, { descricao: e.target.value })}
                            onBlur={() => persist(r)}
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <button
                            onClick={() => remover(r)}
                            title="Remover parâmetro deste filtro"
                            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {vrsDoFiltro.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[12px] text-muted-foreground">
                        Sem parâmetros cadastrados neste filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé: adicionar parâmetro faltante */}
            {parametrosFaltantes.length > 0 && (
              <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20 flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground shrink-0">Adicionar parâmetro:</span>
                <div className="flex-1 max-w-xs">
                  <Select value={novoParam} onValueChange={setNovoParam}>
                    <SelectTrigger className="rounded-md h-8 text-[12px] bg-background border-border/60">
                      <SelectValue placeholder="Selecione um parâmetro" />
                    </SelectTrigger>
                    <SelectContent>
                      {parametrosFaltantes.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <button
                  onClick={adicionarParametro}
                  disabled={!novoParam}
                  className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default FiltrosPorPerfil;
