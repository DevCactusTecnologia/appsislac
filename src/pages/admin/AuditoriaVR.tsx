// Página de auditoria de Valores de Referência.
// Lista entradas de `valores_referencia` cujo `parametro_nome` NÃO casa
// (case-insensitive) com nenhum `exame_parametros.chave|rotulo|abreviacao`
// do exame correspondente. Esses VRs nunca alimentam ##REF_X##/##UNID_X##/##FLAG_X##
// no laudo e produzem placeholders não resolvidos.
//
// Sugere correção mostrando os parâmetros válidos do exame (nome mais próximo).

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { updateValorReferencia, type ValorReferencia } from "@/data/valoresReferenciaStore";

interface VRRow {
  id: number;
  exame_nome: string;
  parametro_nome: string;
  sexo: string;
  idade_min: string;
  idade_max: string;
  unidade_idade: string;
  valor_min: string;
  valor_max: string;
  unidade: string;
  descricao: string;
}

interface ParametroRow {
  id: number;
  exame_id: string;
  rotulo: string;
  chave: string;
  abreviacao: string;
}

interface ExameRow {
  id: string;
  nome: string;
}

interface OrfaoInfo {
  vr: VRRow;
  exameId: string | null;        // id do catálogo (se exame existe)
  parametrosValidos: Array<{ nome: string; tipo: "chave" | "abreviacao" | "rotulo" }>;
  sugestao: string | null;       // melhor candidato para substituição
  motivo: "exame-inexistente" | "parametro-nao-encontrado";
}

const norm = (s: string) => (s ?? "").trim().toLowerCase();

/** Distância de Levenshtein simples (O(n*m)) — uso pontual em listas pequenas. */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

function melhorCandidato(alvo: string, opcoes: string[]): string | null {
  if (opcoes.length === 0) return null;
  const a = norm(alvo);
  let melhor = opcoes[0];
  let menor = distancia(a, norm(melhor));
  for (let i = 1; i < opcoes.length; i++) {
    const d = distancia(a, norm(opcoes[i]));
    if (d < menor) { menor = d; melhor = opcoes[i]; }
  }
  // só sugere se a distância for razoável (≤ 60% do tamanho)
  return menor <= Math.ceil(Math.max(3, a.length * 0.6)) ? melhor : null;
}

const AuditoriaVR = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [orfaos, setOrfaos] = useState<OrfaoInfo[]>([]);
  const [totalVRs, setTotalVRs] = useState(0);
  const [aplicando, setAplicando] = useState<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const [vrRes, exRes, pRes] = await Promise.all([
        supabase.from("valores_referencia").select("*").order("exame_nome"),
        supabase.from("exames_catalogo").select("id, nome"),
        supabase.from("exame_parametros").select("id, exame_id, rotulo, chave, abreviacao"),
      ]);
      if (vrRes.error) throw vrRes.error;
      if (exRes.error) throw exRes.error;
      if (pRes.error) throw pRes.error;

      const vrs = (vrRes.data ?? []) as VRRow[];
      const exames = (exRes.data ?? []) as ExameRow[];
      const params = (pRes.data ?? []) as ParametroRow[];

      // Index exames por nome (normalizado) → id
      const exameByNome = new Map<string, string>();
      for (const e of exames) exameByNome.set(norm(e.nome), e.id);

      // Index parametros por exame_id
      const paramsByExame = new Map<string, ParametroRow[]>();
      for (const p of params) {
        const arr = paramsByExame.get(p.exame_id) ?? [];
        arr.push(p);
        paramsByExame.set(p.exame_id, arr);
      }

      const out: OrfaoInfo[] = [];
      for (const vr of vrs) {
        const exameId = exameByNome.get(norm(vr.exame_nome)) ?? null;
        if (!exameId) {
          out.push({
            vr, exameId: null, parametrosValidos: [], sugestao: null,
            motivo: "exame-inexistente",
          });
          continue;
        }
        const ps = paramsByExame.get(exameId) ?? [];
        const alvo = norm(vr.parametro_nome);
        const casa = ps.some((p) =>
          [p.chave, p.abreviacao, p.rotulo]
            .map(norm)
            .filter(Boolean)
            .includes(alvo)
        );
        if (casa) continue;

        const validos = ps.flatMap<{ nome: string; tipo: "chave" | "abreviacao" | "rotulo" }>((p) => {
          const r: Array<{ nome: string; tipo: "chave" | "abreviacao" | "rotulo" }> = [];
          if (p.rotulo) r.push({ nome: p.rotulo, tipo: "rotulo" });
          if (p.chave) r.push({ nome: p.chave, tipo: "chave" });
          if (p.abreviacao) r.push({ nome: p.abreviacao, tipo: "abreviacao" });
          return r;
        });
        const sugestao = melhorCandidato(vr.parametro_nome, validos.map((v) => v.nome));
        out.push({
          vr, exameId, parametrosValidos: validos, sugestao,
          motivo: "parametro-nao-encontrado",
        });
      }

      setOrfaos(out);
      setTotalVRs(vrs.length);
    } catch (e) {
      toast({ title: "Falha ao carregar auditoria", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = norm(filtro);
    if (!q) return orfaos;
    return orfaos.filter((o) =>
      norm(o.vr.exame_nome).includes(q) ||
      norm(o.vr.parametro_nome).includes(q) ||
      (o.sugestao && norm(o.sugestao).includes(q)),
    );
  }, [orfaos, filtro]);

  const aplicarSugestao = async (o: OrfaoInfo) => {
    if (!o.sugestao) return;
    setAplicando(o.vr.id);
    try {
      const novo: Omit<ValorReferencia, "id"> = {
        exameNome: o.vr.exame_nome,
        parametroNome: o.sugestao,
        sexo: (o.vr.sexo as ValorReferencia["sexo"]),
        idadeMin: o.vr.idade_min ?? "",
        idadeMax: o.vr.idade_max ?? "",
        unidadeIdade: (o.vr.unidade_idade as ValorReferencia["unidadeIdade"]) ?? "Anos",
        valorMin: o.vr.valor_min ?? "",
        valorMax: o.vr.valor_max ?? "",
        unidade: o.vr.unidade ?? "",
        descricao: o.vr.descricao ?? "",
      };
      const ok = await updateValorReferencia(o.vr.id, novo);
      if (!ok) throw new Error("update failed");
      toast({ title: "Parâmetro corrigido", description: `${o.vr.parametro_nome} → ${o.sugestao}` });
      await carregar();
    } catch (e) {
      toast({ title: "Falha ao aplicar sugestão", description: String((e as Error)?.message ?? e), variant: "destructive" });
    } finally {
      setAplicando(null);
    }
  };

  const ok = totalVRs - orfaos.length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Auditoria de Valores de Referência"
        description="Detecta VRs cujo nome de parâmetro não casa com chave/rótulo/abreviação dos parâmetros do exame — esses VRs não resolvem ##REF_X##/##UNID_X##/##FLAG_X## no laudo."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total de VRs</div>
          <div className="text-2xl font-semibold mt-1">{totalVRs}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-success))]" /> Compatíveis
          </div>
          <div className="text-2xl font-semibold mt-1">{ok}</div>
        </div>
        <div className="rounded-lg border border-[hsl(var(--status-warning))]/40 bg-[hsl(var(--status-warning))]/5 p-4">
          <div className="text-[11px] uppercase tracking-wider text-[hsl(var(--status-warning))] flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Órfãos
          </div>
          <div className="text-2xl font-semibold mt-1">{orfaos.length}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar por exame, parâmetro ou sugestão…"
            className="pl-8 h-9 rounded-lg"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-1.5">Re-analisar</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Analisando valores de referência…
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background p-12 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-[hsl(var(--status-success))] mb-3" />
          <div className="text-sm font-medium">Nenhum VR órfão</div>
          <div className="text-xs text-muted-foreground mt-1">
            Todos os {totalVRs} VRs casam com parâmetros existentes.
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border/40">
              <tr>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Exame</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Parâmetro no VR</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Motivo</th>
                <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sugestão</th>
                <th className="text-right py-2.5 px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((o) => (
                <tr key={o.vr.id} className="border-b border-border/20 hover:bg-muted/20">
                  <td className="py-2.5 px-3 align-top">
                    <div className="font-medium text-foreground">{o.vr.exame_nome}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {o.vr.sexo} • {o.vr.idade_min}–{o.vr.idade_max} {o.vr.unidade_idade}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    <code className="text-[12px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                      {o.vr.parametro_nome || "(vazio)"}
                    </code>
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    {o.motivo === "exame-inexistente" ? (
                      <span className="text-[11px] text-destructive">Exame não existe no catálogo</span>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">
                        Nenhum parâmetro do exame casa.{" "}
                        {o.parametrosValidos.length > 0 && (
                          <span className="block mt-1">
                            Válidos:{" "}
                            {o.parametrosValidos.slice(0, 6).map((p, i) => (
                              <span key={`${p.nome}-${i}`}>
                                {i > 0 && ", "}
                                <code className="bg-muted px-1 rounded text-[10px]">{p.nome}</code>
                              </span>
                            ))}
                            {o.parametrosValidos.length > 6 && ` +${o.parametrosValidos.length - 6}`}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 align-top">
                    {o.sugestao ? (
                      <code className="text-[12px] bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))] px-1.5 py-0.5 rounded">
                        {o.sugestao}
                      </code>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 align-top text-right">
                    <div className="flex justify-end gap-1.5">
                      {o.sugestao && (
                        <Button
                          size="sm"
                          variant="default"
                          disabled={aplicando === o.vr.id}
                          onClick={() => void aplicarSugestao(o)}
                        >
                          {aplicando === o.vr.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aplicar"}
                        </Button>
                      )}
                      {o.exameId && (
                        <Link
                          to={`/exames?exame=${o.exameId}`}
                          className="inline-flex items-center gap-1 h-8 px-2 rounded-md border border-border/60 text-[11px] hover:bg-muted/40"
                          title="Abrir exame"
                        >
                          <ExternalLink className="h-3 w-3" /> Exame
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditoriaVR;
