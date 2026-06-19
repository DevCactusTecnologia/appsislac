import { useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Loader2, Plus, Check, X, AlertCircle, EyeOff, ShieldCheck, FileText } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type ConfiancaIA = "alta" | "media" | "baixa";

export interface SugestaoIA {
  exame: string;
  justificativa: string;
  confianca?: ConfiancaIA;
}

export interface AddExameIAOptions {
  justificativa?: string;
  confianca?: ConfiancaIA;
  /** Texto da observação a ser anexada ao exame (se "anexar justificativa" estiver ligado). */
  observacao?: string;
}

type Foco = "triagem" | "investigacao" | "acompanhamento";

interface AvaliacaoIADialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Callback de adicionar exame.
   * O segundo argumento é opcional para retrocompatibilidade — chamadores antigos
   * podem ignorá-lo. Quando o usuário ativa "Salvar justificativa", `observacao`
   * vem preenchido com a justificativa formatada da IA.
   */
  onAddExame?: (nome: string, opts?: AddExameIAOptions) => void;
  examesAtuais?: string[];
  /** Sexo do paciente: "M" / "F" / "Masculino" / "Feminino" — usado para contexto da IA. */
  sexo?: string;
  /** Idade do paciente em anos (ou string descritiva) — usado para contexto da IA. */
  idade?: number | string;
  /** Histórico de exames realizados anteriormente pelo paciente. */
  historicoExames?: string[];
  /** Catálogo de exames disponíveis no laboratório (restringe sugestões). */
  catalogoDisponivel?: string[];
}

const AvaliacaoIADialog = ({
  open,
  onOpenChange,
  onAddExame,
  examesAtuais = [],
  sexo,
  idade,
  historicoExames = [],
  catalogoDisponivel = [],
}: AvaliacaoIADialogProps) => {
  const [queixa, setQueixa] = useState("");
  const [sugestoes, setSugestoes] = useState<SugestaoIA[]>([]);
  const [loading, setLoading] = useState(false);
  const [analisado, setAnalisado] = useState(false);
  const [adicionados, setAdicionados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState<Foco>("triagem");
  const [removidos, setRemovidos] = useState<Set<string>>(new Set());
  const [salvarJustificativa, setSalvarJustificativa] = useState(true);

  const examesAtuaisNorm = examesAtuais.map((e) => e.toUpperCase());
  const catalogoNorm = new Set(catalogoDisponivel.map((c) => c.toUpperCase().trim()));

  const analisar = async () => {
    if (!queixa.trim()) return;
    setLoading(true);
    setAdicionados(new Set());
    setRemovidos(new Set());
    setErro(null);
    setSugestoes([]);
    try {
      const { data, error } = await supabase.functions.invoke("ai-suggest-exames", {
        body: {
          queixa: queixa.trim(),
          sexo: sexo || undefined,
          idade: idade ?? undefined,
          exames_atuais: examesAtuais,
          historico_exames: historicoExames,
          catalogo_disponivel: catalogoDisponivel,
          foco,
        },
      });

      if (error) {
        // Edge function retornou status != 2xx
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 429) {
          setErro("Muitas requisições. Tente novamente em instantes.");
        } else if (status === 402) {
          setErro("Créditos da IA esgotados. Contate o administrador.");
        } else {
          setErro(error.message || "Falha ao consultar a IA.");
        }
        toast({ title: "IA indisponível", description: erro || "Tente novamente.", variant: "destructive" });
        return;
      }

      const listaBruta = Array.isArray((data as { sugestoes?: SugestaoIA[] })?.sugestoes)
        ? (data as { sugestoes: SugestaoIA[] }).sugestoes
        : [];

      // Validação contra catálogo: filtra exames que não existem no catálogo do tenant.
      // Se catálogo não foi fornecido (vazio), aceita tudo.
      let foraDoCatalogo = 0;
      const lista = catalogoNorm.size === 0
        ? listaBruta
        : listaBruta.filter((s) => {
            const ok = catalogoNorm.has(s.exame.toUpperCase().trim());
            if (!ok) foraDoCatalogo += 1;
            return ok;
          });

      if (foraDoCatalogo > 0) {
        toast({
          title: "Sugestões filtradas",
          description: `${foraDoCatalogo} sugestão(ões) ignorada(s) por não constar(em) no catálogo de exames do laboratório.`,
          variant: "default",
        });
      }

      setSugestoes(lista);
      setAnalisado(true);
      if (lista.length === 0) {
        setErro(
          foraDoCatalogo > 0
            ? "Nenhuma sugestão da IA é compatível com o catálogo do laboratório."
            : "Nenhuma sugestão retornada para esta queixa.",
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setErro(msg);
      toast({ title: "Erro na análise", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQueixa("");
    setSugestoes([]);
    setAnalisado(false);
    setAdicionados(new Set());
    setRemovidos(new Set());
    setErro(null);
    setFoco("triagem");
    onOpenChange(false);
  };

  const jaAdicionado = (exame: string) => examesAtuaisNorm.includes(exame.toUpperCase()) || adicionados.has(exame);
  const handleAdd = (s: SugestaoIA) => {
    if (jaAdicionado(s.exame)) return;
    // Validação final: o exame DEVE estar no catálogo (se o catálogo foi fornecido).
    if (catalogoNorm.size > 0 && !catalogoNorm.has(s.exame.toUpperCase().trim())) {
      toast({
        title: "Exame não encontrado no catálogo",
        description: `"${s.exame}" não está cadastrado no catálogo deste laboratório e não pode ser adicionado.`,
        variant: "destructive",
      });
      return;
    }
    const observacao = salvarJustificativa && s.justificativa
      ? `[IA — ${s.confianca || "media"}] ${s.justificativa}`
      : undefined;
    onAddExame?.(s.exame, {
      justificativa: s.justificativa,
      confianca: s.confianca,
      observacao,
    });
    setAdicionados((prev) => new Set(prev).add(s.exame));
  };

  const handleRemoverSugestao = (exame: string) => {
    setRemovidos((prev) => new Set(prev).add(exame));
  };

  const sugestoesVisiveis = sugestoes.filter((s) => !removidos.has(s.exame));
  const sugestoesNovos = sugestoesVisiveis.filter((s) => !examesAtuaisNorm.includes(s.exame.toUpperCase()));
  const sugestoesJaAdicionados = sugestoes.filter((s) => examesAtuaisNorm.includes(s.exame.toUpperCase()));

  const focoOptions: { value: Foco; label: string; descricao: string }[] = [
    { value: "triagem", label: "Triagem", descricao: "Rastreio amplo" },
    { value: "investigacao", label: "Investigação", descricao: "Hipóteses específicas" },
    { value: "acompanhamento", label: "Acompanhamento", descricao: "Monitorar condição" },
  ];

  const confiancaStyle = (c?: ConfiancaIA): { bg: string; text: string; label: string } => {
    if (c === "alta") return { bg: "hsl(var(--status-success) / 0.12)", text: "hsl(var(--status-success))", label: "Alta" };
    if (c === "baixa") return { bg: "hsl(var(--muted-foreground) / 0.12)", text: "hsl(var(--muted-foreground))", label: "Baixa" };
    return { bg: "hsl(var(--status-purple) / 0.12)", text: "hsl(var(--status-purple))", label: "Média" };
  };

  useBodyScrollLock(open);

  if (!open) return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={handleClose} />
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[hsl(var(--status-purple))]/8 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-[hsl(var(--status-purple))]" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Avaliação IA</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Sugestão inteligente de exames</p>
            </div>
          </div>
          <button onClick={handleClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Seletor de foco */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Foco da sugestão</label>
            <div className="grid grid-cols-3 gap-1.5">
              {focoOptions.map((opt) => {
                const ativo = foco === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFoco(opt.value)}
                    className={`text-left px-3 py-2 rounded-xl border text-[12px] transition-all duration-200 ${
                      ativo
                        ? "border-primary/60 bg-primary/8 text-foreground"
                        : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <div className="font-semibold leading-tight">{opt.label}</div>
                    <div className="text-[10px] opacity-70 leading-tight mt-0.5">{opt.descricao}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Queixa do paciente</label>
            <textarea
              placeholder="Ex: Paciente relata dor de cabeça frequente, cansaço e febre há 3 dias..."
              value={queixa}
              onChange={(e) => { setQueixa(e.target.value); if (analisado) setAnalisado(false); if (erro) setErro(null); }}
              className="w-full min-h-[100px] px-3 py-2.5 bg-muted/30 border border-border/60 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all duration-200 resize-none"
            />
          </div>

          {/* Toggle Salvar justificativa */}
          <label className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-muted/20 border border-border/40 cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              checked={salvarJustificativa}
              onChange={(e) => setSalvarJustificativa(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Salvar justificativa como observação
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                Anexa o motivo clínico da IA ao exame ao adicionar.
              </p>
            </div>
          </label>

          <button
            onClick={analisar}
            disabled={!queixa.trim() || loading}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-sm"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analisando...</> : <><Sparkles className="h-4 w-4" /> Analisar queixa</>}
          </button>

          {erro && !loading && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{erro}</p>
            </div>
          )}

          {analisado && sugestoes.length > 0 && (
            <div className="space-y-4">
              {sugestoesNovos.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exames sugeridos</h3>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {sugestoesNovos.map((s) => {
                      const conf = confiancaStyle(s.confianca);
                      const isAdicionado = adicionados.has(s.exame);
                      return (
                        <div key={s.exame} className="px-4 py-3 rounded-2xl bg-muted/30 border border-border/40 hover:border-border/80 transition-all duration-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-medium text-foreground truncate">{s.exame}</p>
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                                  style={{ backgroundColor: conf.bg, color: conf.text }}
                                  title={`Confiança ${conf.label}`}
                                >
                                  <ShieldCheck className="h-2.5 w-2.5" />
                                  {conf.label}
                                </span>
                              </div>
                              {s.justificativa && (
                                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.justificativa}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {onAddExame && (
                                isAdicionado ? (
                                  <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "hsl(var(--status-success))" }}>
                                    <Check className="h-3 w-3" /> Adicionado
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleAdd(s)}
                                    className="h-8 px-3 rounded-xl border border-border/60 bg-background text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1"
                                  >
                                    <Plus className="h-3 w-3" /> Adicionar
                                  </button>
                                )
                              )}
                              {!isAdicionado && (
                                <button
                                  onClick={() => handleRemoverSugestao(s.exame)}
                                  className="h-8 w-8 rounded-xl border border-border/60 bg-background text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-all duration-200 flex items-center justify-center"
                                  title="Remover sugestão"
                                  aria-label={`Remover sugestão ${s.exame}`}
                                >
                                  <EyeOff className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sugestoesJaAdicionados.length > 0 && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Já adicionados ao atendimento:</p>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                    {sugestoesJaAdicionados.map((s) => (
                      <div key={s.exame} className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-muted/20 border border-border/30 opacity-60">
                        <span className="text-[13px] text-muted-foreground truncate">{s.exame}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium"><Check className="h-3 w-3" /> Já incluído</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sugestoesNovos.length === 0 && removidos.size === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Todos os exames sugeridos já foram adicionados! ✓</p>
              )}
              {sugestoesNovos.length === 0 && removidos.size > 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">Todas as sugestões restantes foram removidas ou já estão no atendimento.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body);
};

export default AvaliacaoIADialog;
