import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { FileScan, Loader2, Plus, Check, X, AlertCircle, Upload, FileText, ShieldCheck, AlertTriangle } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ExameDetectado {
  nomeOriginal: string;
  nomeCatalogo?: string;
  solicitante?: string;
  confianca?: "alta" | "media" | "baixa";
}

export interface AddExameLeituraOptions {
  solicitante?: string;
  observacao?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Catálogo de exames disponíveis no laboratório (nomes). */
  catalogoDisponivel: string[];
  /** Solicitantes já adicionados ao atendimento. */
  solicitantes: string[];
  /** Exames já presentes na lista atual (para evitar duplicatas). */
  examesAtuais: string[];
  /** Callback para adicionar exame ao atendimento. */
  onAddExame: (nome: string, opts?: AddExameLeituraOptions) => void;
}

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });
}

const confiancaStyle = (c?: "alta" | "media" | "baixa") => {
  if (c === "alta") return { bg: "hsl(var(--status-success) / 0.12)", text: "hsl(var(--status-success))", label: "Alta" };
  if (c === "baixa") return { bg: "hsl(var(--muted-foreground) / 0.12)", text: "hsl(var(--muted-foreground))", label: "Baixa" };
  return { bg: "hsl(var(--status-purple) / 0.12)", text: "hsl(var(--status-purple))", label: "Média" };
};

const LeituraRequisicaoDialog = ({
  open,
  onOpenChange,
  catalogoDisponivel,
  solicitantes,
  examesAtuais,
  onAddExame,
}: Props) => {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [analisado, setAnalisado] = useState(false);
  const [detectados, setDetectados] = useState<ExameDetectado[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [adicionados, setAdicionados] = useState<Set<string>>(new Set());
  /** Sobrescrita manual de solicitante por exame (chave = nomeOriginal). */
  const [solicitanteOverride, setSolicitanteOverride] = useState<Record<string, string>>({});
  /** Exames que o usuário marcou explicitamente como confirmados (chave = nomeOriginal). */
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useBodyScrollLock(open);

  const reset = () => {
    setArquivos([]);
    setPreviews([]);
    setLoading(false);
    setAnalisado(false);
    setDetectados([]);
    setErro(null);
    setAdicionados(new Set());
    setSolicitanteOverride({});
    setConfirmados(new Set());
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFiles = (files: FileList | File[] | null) => {
    if (!files) return;
    const arr = Array.from(files).filter((f) => ALLOWED.includes(f.type));
    if (arr.length === 0) {
      toast({ title: "Formato não suportado", description: "Use JPG, PNG, WEBP ou PDF.", variant: "destructive" });
      return;
    }
    const total = arquivos.length + arr.length;
    if (total > 6) {
      toast({ title: "Muitos arquivos", description: "Máximo de 6 páginas/arquivos.", variant: "destructive" });
      return;
    }
    setArquivos((prev) => [...prev, ...arr]);
    arr.forEach((f) => {
      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        setPreviews((prev) => [...prev, url]);
      } else {
        setPreviews((prev) => [...prev, ""]);
      }
    });
    setAnalisado(false);
    setErro(null);
  };

  const removeArquivo = (idx: number) => {
    setArquivos((prev) => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => {
      const out = prev.filter((_, i) => i !== idx);
      const removed = prev[idx];
      if (removed) URL.revokeObjectURL(removed);
      return out;
    });
    setAnalisado(false);
  };

  const analisar = async () => {
    if (arquivos.length === 0) return;
    setLoading(true);
    setErro(null);
    setDetectados([]);
    setAdicionados(new Set());
    setSolicitanteOverride({});
    setConfirmados(new Set());
    try {
      const files = await Promise.all(
        arquivos.map(async (f) => ({
          name: f.name,
          mimeType: f.type,
          dataBase64: await fileToBase64(f),
        })),
      );
      const { data, error } = await supabase.functions.invoke("extract-requisicao-exames", {
        body: {
          files,
          catalogo: catalogoDisponivel,
          solicitantes,
        },
      });
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 429) setErro("Muitas requisições. Tente novamente em instantes.");
        else if (status === 402) setErro("Créditos da IA esgotados. Contate o administrador.");
        else setErro(error.message || "Falha ao consultar a IA.");
        return;
      }
      const lista = (data as { data?: { exames?: ExameDetectado[] } })?.data?.exames ?? [];
      setDetectados(lista);
      setAnalisado(true);
      if (lista.length === 0) setErro("Nenhum exame foi identificado na imagem.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const examesAtuaisNorm = examesAtuais.map((e) => e.toLowerCase().trim());
  const jaNoAtendimento = (nome?: string) => !!nome && examesAtuaisNorm.includes(nome.toLowerCase().trim());

  const handleAdd = (det: ExameDetectado) => {
    const nome = det.nomeCatalogo;
    if (!nome) {
      toast({ title: "Exame fora do catálogo", description: `"${det.nomeOriginal}" não está cadastrado e não pode ser adicionado.`, variant: "destructive" });
      return;
    }
    if (jaNoAtendimento(nome) || adicionados.has(det.nomeOriginal)) return;
    if (!confirmados.has(det.nomeOriginal)) {
      toast({ title: "Confirme o exame", description: `Marque "${det.nomeCatalogo}" como confirmado antes de adicionar.`, variant: "destructive" });
      return;
    }
    const sol = solicitanteOverride[det.nomeOriginal] ?? det.solicitante ?? "";
    onAddExame(nome, { solicitante: sol || undefined, observacao: `[Requisição IA] lido como "${det.nomeOriginal}"` });
    setAdicionados((prev) => new Set(prev).add(det.nomeOriginal));
  };

  const adicionarConfirmados = () => {
    let added = 0;
    const adicionadosNomes: string[] = [];
    detectados.forEach((d) => {
      if (!d.nomeCatalogo) return;
      if (jaNoAtendimento(d.nomeCatalogo) || adicionados.has(d.nomeOriginal)) return;
      if (!confirmados.has(d.nomeOriginal)) return;
      const sol = solicitanteOverride[d.nomeOriginal] ?? d.solicitante ?? "";
      onAddExame(d.nomeCatalogo, { solicitante: sol || undefined, observacao: `[Requisição IA] lido como "${d.nomeOriginal}"` });
      added += 1;
      adicionadosNomes.push(d.nomeOriginal);
    });
    if (added > 0) {
      setAdicionados((prev) => {
        const next = new Set(prev);
        adicionadosNomes.forEach((n) => next.add(n));
        return next;
      });
      toast({ title: `${added} exame${added > 1 ? "s" : ""} adicionado${added > 1 ? "s" : ""}` });
    } else {
      toast({ title: "Nada a adicionar", description: "Confirme ao menos um exame antes de continuar.", variant: "destructive" });
    }
  };

  const toggleConfirmar = (nomeOriginal: string) => {
    setConfirmados((prev) => {
      const next = new Set(prev);
      if (next.has(nomeOriginal)) next.delete(nomeOriginal);
      else next.add(nomeOriginal);
      return next;
    });
  };

  const confirmarTodosAlta = () => {
    setConfirmados((prev) => {
      const next = new Set(prev);
      detectados.forEach((d) => {
        if (d.nomeCatalogo && d.confianca === "alta" && !jaNoAtendimento(d.nomeCatalogo) && !adicionados.has(d.nomeOriginal)) {
          next.add(d.nomeOriginal);
        }
      });
      return next;
    });
  };

  const confirmarTodos = () => {
    setConfirmados((prev) => {
      const next = new Set(prev);
      detectados.forEach((d) => {
        if (d.nomeCatalogo && !jaNoAtendimento(d.nomeCatalogo) && !adicionados.has(d.nomeOriginal)) {
          next.add(d.nomeOriginal);
        }
      });
      return next;
    });
  };

  const desmarcarTodos = () => {
    setConfirmados(new Set());
  };

  if (!open) return null;

  const validos = detectados.filter((d) => d.nomeCatalogo);
  const invalidos = detectados.filter((d) => !d.nomeCatalogo);
  const baixaOuMedia = validos.filter((d) => d.confianca !== "alta").length;
  const pendentesConfirmacao = validos.filter((d) => !confirmados.has(d.nomeOriginal) && !jaNoAtendimento(d.nomeCatalogo) && !adicionados.has(d.nomeOriginal)).length;

  const pendentes = validos.filter((d) => !jaNoAtendimento(d.nomeCatalogo) && !adicionados.has(d.nomeOriginal));
  const totalPendentes = pendentes.length;
  const altaConfirmados = pendentes.filter((d) => d.confianca === "alta" && confirmados.has(d.nomeOriginal)).length;
  const altaPendentes = pendentes.filter((d) => d.confianca === "alta" && !confirmados.has(d.nomeOriginal)).length;
  const mediaCount = pendentes.filter((d) => d.confianca === "media").length;
  const baixaCount = pendentes.filter((d) => d.confianca === "baixa").length;
  const todosConfirmados = totalPendentes > 0 && pendentes.every((d) => confirmados.has(d.nomeOriginal));

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={handleClose} />
      <div className="relative w-full max-w-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/8 flex items-center justify-center">
              <FileScan className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">Ler requisição</h2>
              <p className="text-xs text-muted-foreground mt-0.5">A IA identifica os exames a partir de foto ou PDF do pedido</p>
            </div>
          </div>
          <button onClick={handleClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-border/50" />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Upload */}
          <div>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED.join(",")}
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full h-28 rounded-2xl border-2 border-dashed border-border/70 hover:border-primary/40 bg-muted/20 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-all"
            >
              <Upload className="h-5 w-5" />
              <p className="text-sm font-medium">Selecionar foto ou PDF da requisição</p>
              <p className="text-[11px] opacity-70">JPG, PNG, WEBP ou PDF — até 6 páginas</p>
            </button>
          </div>

          {arquivos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {arquivos.map((f, i) => (
                <div key={i} className="relative group">
                  <div className="aspect-square rounded-xl border border-border/60 bg-muted/30 overflow-hidden flex items-center justify-center">
                    {previews[i] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[i]} alt={f.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <FileText className="h-6 w-6" />
                        <span className="text-[9px] truncate max-w-[80px]">{f.name}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeArquivo(i)}
                    className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={analisar}
            disabled={arquivos.length === 0 || loading}
            className="w-full h-11 rounded-2xl bg-primary text-primary-foreground text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Lendo requisição...</>
            ) : (
              <><FileScan className="h-4 w-4" /> Analisar com IA</>
            )}
          </button>

          {erro && !loading && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-destructive/8 border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive leading-relaxed">{erro}</p>
            </div>
          )}

          {analisado && validos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Exames identificados ({validos.length})
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Revise e <span className="font-semibold text-foreground">confirme</span> cada exame antes de adicionar.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {baixaOuMedia > 0 && (
                    <button
                      onClick={confirmarTodosAlta}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
                      title="Marca como confirmados apenas os exames de alta confiança"
                    >
                      Confirmar alta confiança
                    </button>
                  )}
                  {totalPendentes > 0 && (
                    <button
                      onClick={todosConfirmados ? desmarcarTodos : confirmarTodos}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all"
                      title={todosConfirmados ? "Desmarcar todos os exames" : "Marcar todos os exames como confirmados (inclusive os de baixa/média confiança)"}
                    >
                      {todosConfirmados ? "Desmarcar todos" : "Confirmar todos"}
                    </button>
                  )}
                  <button
                    onClick={adicionarConfirmados}
                    className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border border-primary/30 text-primary hover:bg-primary/8 transition-all"
                  >
                    Adicionar confirmados
                  </button>
                </div>
              </div>

              {/* Checklist de status (resumo por categoria) */}
              {totalPendentes > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div
                    className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: "hsl(var(--status-success) / 0.06)",
                      borderColor: "hsl(var(--status-success) / 0.20)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Check className="h-3 w-3" style={{ color: "hsl(var(--status-success))" }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--status-success))" }}>
                        Alta confirmada
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{altaConfirmados}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border border-border/60 bg-muted/20">
                    <div className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Alta pendente
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{altaPendentes}</span>
                  </div>
                  <div
                    className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: "hsl(var(--status-purple) / 0.06)",
                      borderColor: "hsl(var(--status-purple) / 0.20)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3 w-3" style={{ color: "hsl(var(--status-purple))" }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--status-purple))" }}>
                        Revisar (média)
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{mediaCount}</span>
                  </div>
                  <div
                    className="flex flex-col gap-0.5 px-3 py-2 rounded-xl border"
                    style={{
                      backgroundColor: "hsl(var(--destructive) / 0.06)",
                      borderColor: "hsl(var(--destructive) / 0.20)",
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 text-destructive" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                        Baixa confiança
                      </span>
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums">{baixaCount}</span>
                  </div>
                </div>
              )}

              {(baixaOuMedia > 0 || pendentesConfirmacao > 0) && (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: "hsl(var(--status-purple) / 0.08)",
                    borderColor: "hsl(var(--status-purple) / 0.20)",
                  }}
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "hsl(var(--status-purple))" }} />
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {baixaOuMedia > 0 && (
                      <>
                        <span className="font-semibold">{baixaOuMedia}</span> exame{baixaOuMedia > 1 ? "s" : ""} com confiança média/baixa precisam de revisão manual.{" "}
                      </>
                    )}
                    Nenhum exame é adicionado automaticamente — confirme cada item antes de incluir no atendimento.
                  </p>
                </div>
              )}

              <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                {validos.map((d) => {
                  const conf = confiancaStyle(d.confianca);
                  const adicionado = adicionados.has(d.nomeOriginal) || jaNoAtendimento(d.nomeCatalogo);
                  const solValue = solicitanteOverride[d.nomeOriginal] ?? d.solicitante ?? "";
                  const isConfirmado = confirmados.has(d.nomeOriginal);
                  const precisaAtencao = d.confianca !== "alta" && !adicionado;
                  const cardStyle: CSSProperties = !adicionado && precisaAtencao && !isConfirmado
                    ? {
                        backgroundColor: "hsl(var(--status-purple) / 0.05)",
                        borderColor: "hsl(var(--status-purple) / 0.25)",
                      }
                    : {};
                  return (
                    <div
                      key={d.nomeOriginal}
                      className={`px-3.5 py-3 rounded-2xl border transition-all ${
                        adicionado
                          ? "bg-muted/30 border-border/40"
                          : isConfirmado
                          ? "bg-primary/5 border-primary/30"
                          : precisaAtencao
                          ? "border-transparent"
                          : "bg-muted/30 border-border/40"
                      }`}
                      style={cardStyle}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {!adicionado && (
                          <button
                            onClick={() => toggleConfirmar(d.nomeOriginal)}
                            className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                              isConfirmado
                                ? "bg-primary border-primary text-primary-foreground"
                                : "bg-background border-border hover:border-primary/50"
                            }`}
                            title={isConfirmado ? "Confirmado — clique para desmarcar" : "Marcar como confirmado"}
                          >
                            {isConfirmado && <Check className="h-3 w-3" />}
                          </button>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[13px] font-semibold text-foreground truncate">{d.nomeCatalogo}</p>
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                              style={{ backgroundColor: conf.bg, color: conf.text }}
                            >
                              <ShieldCheck className="h-2.5 w-2.5" />
                              {conf.label}
                            </span>
                            {precisaAtencao && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                                style={{
                                  backgroundColor: "hsl(var(--status-purple) / 0.12)",
                                  color: "hsl(var(--status-purple))",
                                }}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Revisar
                              </span>
                            )}
                          </div>
                          {d.nomeOriginal.toLowerCase() !== (d.nomeCatalogo || "").toLowerCase() && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Lido como: <span className="italic">{d.nomeOriginal}</span></p>
                          )}
                          {solicitantes.length > 1 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Solicitante</span>
                              <select
                                value={solValue}
                                onChange={(e) => setSolicitanteOverride((prev) => ({ ...prev, [d.nomeOriginal]: e.target.value }))}
                                disabled={adicionado}
                                className="h-7 px-2 pr-6 rounded-lg text-[11px] font-medium bg-background border border-border/60 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60 transition-all"
                              >
                                <option value="">Ambos / não definido</option>
                                {solicitantes.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {adicionado ? (
                            <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "hsl(var(--status-success))" }}>
                              <Check className="h-3 w-3" /> Adicionado
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAdd(d)}
                              disabled={!isConfirmado}
                              className="h-8 px-3 rounded-xl border border-border/60 bg-background text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-border transition-all duration-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground"
                              title={isConfirmado ? "Adicionar ao atendimento" : "Confirme o exame antes de adicionar"}
                            >
                              <Plus className="h-3 w-3" /> Adicionar
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

          {analisado && invalidos.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Não encontrados no catálogo ({invalidos.length})
              </h3>
              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {invalidos.map((d) => (
                  <div key={d.nomeOriginal} className="px-3.5 py-2.5 rounded-2xl bg-muted/20 border border-border/30">
                    <p className="text-[12px] text-muted-foreground truncate">{d.nomeOriginal}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Cadastre este exame no catálogo do laboratório para poder adicioná-lo.</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  ), document.body);
};

export default LeituraRequisicaoDialog;