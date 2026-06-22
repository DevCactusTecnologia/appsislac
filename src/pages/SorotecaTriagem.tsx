/**
 * Soroteca 2.0 — Fase 3: Triagem e Armazenamento
 *
 * Filosofia (igual Financeiro 2.0 / Convênios 2.0 / WhatsApp 2.0):
 *   1 problema · 1 solução · 1 fluxo · 1 verdade · zero overengineering.
 *
 * Regras de negócio (vinculantes):
 *   • A fonte da verdade é `amostras` + `amostra_alocacoes`.
 *   • "Pendente de armazenamento" = amostra DISPONÍVEL sem alocação ativa.
 *   • "Armazenada" = existe linha em `amostra_alocacoes` com retirada_em IS NULL.
 *   • Nenhum status novo, nenhuma tabela nova, nenhum service novo.
 *   • Alocação usa exclusivamente `alocarAmostra()` da Fase 2.
 *   • Sugestão de posição usa exclusivamente `proximaPosicaoLivre()`.
 *
 * UX-alvo: 1 bip + 1 clique em < 10s, sem treinamento.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Barcode,
  ScanLine,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  PackageCheck,
  ListChecks,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { SorotecaNav } from "@/components/soroteca/SorotecaNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AmostraTriagem,
  type PosicaoCaminho,
  type LocalArmazenamento,
  type Galeria,
  type PosicaoGaleria,
  buscarAmostraPorCodigo,
  getAlocacaoAtiva,
  proximaPosicaoLivre,
  getPosicaoCaminho,
  alocarAmostra,
  contarPendentesArmazenamento,
  listarLocais,
  listarGalerias,
  listarPosicoes,
} from "@/data/sorotecaEstruturaStore";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DadosBasicos {
  paciente_nome: string | null;
  setor: string | null;
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SorotecaTriagem() {
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [amostra, setAmostra] = useState<AmostraTriagem | null>(null);
  const [dados, setDados] = useState<DadosBasicos>({ paciente_nome: null, setor: null });
  const [posicao, setPosicao] = useState<PosicaoCaminho | null>(null);
  const [jaArmazenada, setJaArmazenada] = useState<PosicaoCaminho | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState<number>(0);
  const [armazenando, setArmazenando] = useState(false);
  const [trocaAberta, setTrocaAberta] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const hidBufferRef = useRef<{ value: string; lastAt: number }>({ value: "", lastAt: 0 });

  // Foco automático no input.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Contador de pendentes.
  const refreshPendentes = async () => {
    setPendentes(await contarPendentesArmazenamento());
  };
  useEffect(() => {
    refreshPendentes();
  }, []);

  // Captura HID global (mesmo padrão de /soroteca).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      // Se já está no input principal, deixamos o input lidar.
      if (tag === "input" || tag === "textarea" || tag === "select" || editable) return;
      if (trocaAberta) return;
      const now = Date.now();
      const buf = hidBufferRef.current;
      if (now - buf.lastAt > 50) buf.value = "";
      buf.lastAt = now;
      if (e.key === "Enter") {
        const code = buf.value;
        buf.value = "";
        if (code.length >= 4) {
          e.preventDefault();
          void buscar(code);
        }
        return;
      }
      if (e.key.length === 1) {
        buf.value += e.key;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [trocaAberta]);

  const limpar = () => {
    setCodigo("");
    setAmostra(null);
    setDados({ paciente_nome: null, setor: null });
    setPosicao(null);
    setJaArmazenada(null);
    setErro(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const buscar = async (valor?: string) => {
    const v = (valor ?? codigo).trim();
    if (!v) return;
    setLoading(true);
    setErro(null);
    setAmostra(null);
    setPosicao(null);
    setJaArmazenada(null);
    setDados({ paciente_nome: null, setor: null });

    const a = await buscarAmostraPorCodigo(v);
    if (!a) {
      setErro("Amostra não localizada.");
      setLoading(false);
      toast.error("Amostra não localizada.");
      return;
    }
    setAmostra(a);
    setCodigo(a.codigo_barra);

    // Dados auxiliares (paciente + setor do exame) — leves, 1 query cada.
    const [pacRes, exRes, alocAtiva] = await Promise.all([
      a.paciente_id
        ? supabase.from("pacientes").select("nome").eq("id", a.paciente_id).maybeSingle()
        : Promise.resolve({ data: null }),
      a.atendimento_id
        ? supabase
            .from("atendimento_exames")
            .select("setor_laboratorial")
            .eq("amostra_id", a.id)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      getAlocacaoAtiva(a.id),
    ]);
    setDados({
      paciente_nome: (pacRes.data as { nome?: string } | null)?.nome ?? null,
      setor: (exRes.data as { setor_laboratorial?: string } | null)?.setor_laboratorial ?? null,
    });

    // Já armazenada → bloqueia.
    if (alocAtiva) {
      const cam = await getPosicaoCaminho(alocAtiva.posicao_id);
      setJaArmazenada(cam);
      setErro("Amostra já armazenada.");
      setLoading(false);
      return;
    }

    // Sugestão automática de posição livre.
    const livre = await proximaPosicaoLivre({});
    if (!livre) {
      setErro("Nenhuma posição livre encontrada.");
      setLoading(false);
      return;
    }
    const cam = await getPosicaoCaminho(livre.id);
    setPosicao(cam);
    setLoading(false);
  };

  const handleArmazenar = async () => {
    if (!amostra || !posicao) return;
    setArmazenando(true);
    const r = await alocarAmostra({ amostra_id: amostra.id, posicao_id: posicao.posicao_id });
    setArmazenando(false);
    if (!r.ok) {
      toast.error(r.error ?? "Falha ao armazenar.");
      return;
    }
    toast.success(
      `Amostra ${amostra.codigo_barra} armazenada em ${posicao.local_nome} › ${posicao.galeria_nome} › ${posicao.posicao_codigo}.`,
    );
    limpar();
    refreshPendentes();
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6 space-y-4">
      <PageHeader
        eyebrow="Soroteca 2.0"
        title="Triagem e Armazenamento"
        description="Bipe a etiqueta da amostra para armazenar na próxima posição livre."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2.5 py-1 text-xs">
              <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Pendentes:</span>
              <strong className="tabular-nums">{pendentes}</strong>
              <button
                type="button"
                onClick={refreshPendentes}
                className="ml-1 text-muted-foreground hover:text-foreground"
                title="Recontar"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/soroteca")}>
              Voltar
            </Button>
          </div>
        }
      />

      <SorotecaNav />

      {/* Scanner */}

      <section className="rounded-lg border bg-card p-4 space-y-2">
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <ScanLine className="h-4 w-4" />
          Bipe a etiqueta ou digite o código
        </label>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void buscar();
          }}
          className="flex items-center gap-2"
        >
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="A-YYYYMMDD-NNNNNN-D"
              className="pl-9 font-mono"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !codigo.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
          </Button>
          {(amostra || erro) && (
            <Button type="button" variant="ghost" onClick={limpar}>
              Limpar
            </Button>
          )}
        </form>
      </section>

      {/* Erro */}
      {erro && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">{erro}</p>
            {jaArmazenada && (
              <p className="text-xs text-muted-foreground">
                Localização atual: {jaArmazenada.local_nome} › {jaArmazenada.galeria_nome} ›{" "}
                <span className="font-mono">{jaArmazenada.posicao_codigo}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dados da amostra */}
      {amostra && (
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
              Dados da Amostra
            </h2>
            <span
              className={
                "text-[11px] px-2 py-0.5 rounded-md border " +
                (amostra.status === "DISPONIVEL"
                  ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/5"
                  : "border-muted-foreground/30 text-muted-foreground bg-muted/30")
              }
            >
              {amostra.status}
            </span>
          </header>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Código</dt>
              <dd className="font-mono">{amostra.codigo_barra}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Material</dt>
              <dd>{amostra.tipo_material || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Paciente</dt>
              <dd>{dados.paciente_nome ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Setor</dt>
              <dd>{dados.setor ?? "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Data da Coleta
              </dt>
              <dd>{fmt(amostra.data_coleta)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* Próxima Posição Livre */}
      {amostra && posicao && (
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Próxima Posição Livre
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTrocaAberta(true)}
              className="text-xs"
            >
              Trocar
            </Button>
          </header>
          <p className="text-sm">
            <span className="text-muted-foreground">{posicao.local_nome}</span>
            <span className="mx-1 text-muted-foreground">›</span>
            <span className="text-muted-foreground">{posicao.galeria_nome}</span>
            <span className="mx-1 text-muted-foreground">›</span>
            <span className="font-mono font-semibold">{posicao.posicao_codigo}</span>
          </p>
          <Button onClick={handleArmazenar} disabled={armazenando} className="w-full">
            {armazenando ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Armazenar
          </Button>
        </section>
      )}

      <TrocaPosicaoDialog
        open={trocaAberta}
        onOpenChange={setTrocaAberta}
        onConfirm={async (posId) => {
          const cam = await getPosicaoCaminho(posId);
          if (cam) setPosicao(cam);
          setTrocaAberta(false);
        }}
      />
    </div>
  );
}

/** Diálogo simples para escolha manual de posição (exceção, não fluxo padrão). */
function TrocaPosicaoDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (posicao_id: string) => void;
}) {
  const [locais, setLocais] = useState<LocalArmazenamento[]>([]);
  const [galerias, setGalerias] = useState<Galeria[]>([]);
  const [posicoes, setPosicoes] = useState<PosicaoGaleria[]>([]);
  const [ocupadas, setOcupadas] = useState<Set<string>>(new Set());
  const [localSel, setLocalSel] = useState<string>("");
  const [galeriaSel, setGaleriaSel] = useState<string>("");
  const [posSel, setPosSel] = useState<string>("");

  useEffect(() => {
    if (!props.open) return;
    void listarLocais().then(setLocais);
  }, [props.open]);

  useEffect(() => {
    if (!localSel) {
      setGalerias([]);
      setGaleriaSel("");
      return;
    }
    void listarGalerias(localSel).then(setGalerias);
  }, [localSel]);

  useEffect(() => {
    if (!galeriaSel) {
      setPosicoes([]);
      setPosSel("");
      setOcupadas(new Set());
      return;
    }
    void (async () => {
      const pos = await listarPosicoes(galeriaSel);
      setPosicoes(pos);
      const ids = pos.map((p) => p.id);
      if (ids.length === 0) {
        setOcupadas(new Set());
        return;
      }
      const { data } = await supabase
        .from("amostra_alocacoes")
        .select("posicao_id")
        .is("retirada_em", null)
        .in("posicao_id", ids);
      setOcupadas(new Set((data ?? []).map((d) => d.posicao_id as string)));
    })();
  }, [galeriaSel]);

  const livres = useMemo(
    () => posicoes.filter((p) => p.ativo && !ocupadas.has(p.id)),
    [posicoes, ocupadas],
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Escolher posição manualmente</DialogTitle>
          <DialogDescription>
            Use esta opção apenas como exceção — o fluxo padrão é aceitar a sugestão
            automática.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Local</label>
            <Select value={localSel} onValueChange={setLocalSel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {locais.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Galeria</label>
            <Select value={galeriaSel} onValueChange={setGaleriaSel} disabled={!localSel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {galerias.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Posição {livres.length > 0 && `(${livres.length} livres)`}
            </label>
            <Select value={posSel} onValueChange={setPosSel} disabled={!galeriaSel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {livres.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => posSel && props.onConfirm(posSel)} disabled={!posSel}>
            Usar esta posição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
