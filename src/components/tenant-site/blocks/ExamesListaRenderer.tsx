import { useEffect, useMemo, useState } from "react";
import { searchNormalize } from "@/lib/utils";
import { Search, Plus, Check, X, ShoppingCart, Loader2, Star, Home, Building2, AlertCircle, MapPin, Trash2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  listExamesPublicos,
  submitSolicitacaoPublica,
  type ExamePublico,
  listUnidadesPublicas,
  lookupPacientePorCpf,
  type UnidadePublica,
} from "@/lib/tenantSite/vitrineStore";
import { getTenantBySlug } from "@/lib/tenantSite/store";
import { isValidCPF, sanitizeCPF } from "@/lib/cpf";

export interface ExamesListaProps {
  titulo: string;
  descricao: string;
  mostrarPreco: boolean;
  mostrarBusca: boolean;
  apenasDestaque: boolean;
  limite: number;
  layout: "grid" | "lista";
  /** Tenant resolvido pelo TenantSite via path. Quando ausente, tenta resolver pelo slug da URL. */
  tenantId?: string;
}

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

export default function ExamesListaRenderer(props: ExamesListaProps) {
  const { titulo, descricao, mostrarPreco, mostrarBusca, apenasDestaque, limite, layout } = props;
  const params = useParams<{ slug?: string }>();
  const [tenantId, setTenantId] = useState<string | null>(props.tenantId ?? null);
  const [exames, setExames] = useState<ExamePublico[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const buscaDeb = useDebouncedValue(busca, 200);
  const [carrinho, setCarrinho] = useState<Record<string, ExamePublico>>({});
  const [open, setOpen] = useState(false);

  // Resolve tenant_id se não veio por prop (renderização stand-alone)
  useEffect(() => {
    if (props.tenantId) { setTenantId(props.tenantId); return; }
    if (!params.slug) return;
    let alive = true;
    (async () => {
      const t = await getTenantBySlug(params.slug!);
      if (alive) setTenantId(t?.id ?? null);
    })();
    return () => { alive = false; };
  }, [props.tenantId, params.slug]);

  useEffect(() => {
    if (!tenantId) { setLoading(false); return; }
    let alive = true;
    (async () => {
      setLoading(true);
      const data = await listExamesPublicos(tenantId, { destaque: apenasDestaque || undefined, limite });
      if (alive) {
        setExames(data);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [tenantId, apenasDestaque, limite]);

  const filtrados = useMemo(() => {
    const q = searchNormalize(buscaDeb);
    if (!q) return exames;
    return exames.filter((e) => searchNormalize(e.nome).includes(q) || searchNormalize(e.categoria).includes(q));
  }, [exames, buscaDeb]);

  const itensCarrinho = Object.values(carrinho);
  const total = itensCarrinho.reduce((acc, e) => acc + (Number(e.valor) || 0), 0);

  const toggle = (e: ExamePublico) => {
    setCarrinho((prev) => {
      const next = { ...prev };
      if (next[e.exame_id]) delete next[e.exame_id];
      else next[e.exame_id] = e;
      return next;
    });
  };

  const cardClass = layout === "grid"
    ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5"
    : "flex flex-col gap-2.5";

  return (
    <section className="w-full">
      <header className="mb-3 text-center">
        <h2 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{titulo}</h2>
        {descricao ? <p className="text-xs text-muted-foreground/80 mt-1">{descricao}</p> : null}
      </header>

      {mostrarBusca ? (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar exame..."
            className="pl-9 h-10 rounded-full bg-card/70 backdrop-blur-md border-border/60"
            maxLength={60}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8 bg-card/50 backdrop-blur-md border border-border/60 rounded-2xl">
          Nenhum exame disponível no momento.
        </div>
      ) : (
        <div className={cardClass}>
          {filtrados.map((e) => {
            const sel = !!carrinho[e.exame_id];
            return (
              <div
                key={e.exame_id}
                className={`border rounded-2xl p-4 bg-card/70 backdrop-blur-md flex flex-col gap-2 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${sel ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border/60"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-medium text-sm text-foreground truncate">{e.nome}</h3>
                      {e.destaque ? <Star className="h-3.5 w-3.5 text-warning fill-warning" /> : null}
                    </div>
                    {e.categoria ? <p className="text-[11px] text-muted-foreground">{e.categoria}</p> : null}
                  </div>
                  {mostrarPreco && e.valor > 0 ? (
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatBRL(e.valor)}</span>
                  ) : null}
                </div>
                {e.requer_jejum ? <p className="text-[11px] text-muted-foreground">Requer jejum</p> : null}
                <Button
                  size="sm"
                  variant={sel ? "secondary" : "outline"}
                  className="mt-auto w-full rounded-full"
                  onClick={() => toggle(e)}
                >
                  {sel ? (<><Check className="h-3.5 w-3.5 mr-1" /> Selecionado</>) : (<><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar</>)}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Carrinho fixo */}
      {itensCarrinho.length > 0 ? (
        <div
          role="region"
          aria-label={`Carrinho de exames: ${itensCarrinho.length} item${itensCarrinho.length > 1 ? "s" : ""}${mostrarPreco && total > 0 ? `, total ${formatBRL(total)}` : ""}`}
          aria-live="polite"
          className="fixed left-1/2 -translate-x-1/2 z-40 bg-foreground text-background border-2 border-foreground/20 shadow-2xl flex items-center gap-2 sm:gap-3 rounded-full pl-3 sm:pl-5 pr-1.5 py-1.5 w-[calc(100vw-1.5rem)] max-w-md sm:w-auto sm:max-w-none animate-fade-in focus-within:ring-2 focus-within:ring-primary/60 focus-within:ring-offset-2 focus-within:ring-offset-background"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
        >
          <ShoppingCart className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="text-xs sm:text-sm font-medium whitespace-nowrap" aria-live="polite" aria-atomic="true">
            {itensCarrinho.length} <span className="hidden xs:inline">exame{itensCarrinho.length > 1 ? "s" : ""}</span>
          </span>
          {mostrarPreco && total > 0 ? (
            <span className="text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ml-auto sm:ml-0" aria-live="polite" aria-atomic="true">{formatBRL(total)}</span>
          ) : <span className="ml-auto sm:ml-0" />}
          <Button
            size="sm"
            className="rounded-full bg-background text-foreground hover:bg-background/90 h-8 px-3 sm:px-4 text-xs sm:text-sm shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
            onClick={() => setOpen(true)}
            aria-label={`Abrir formulário para solicitar ${itensCarrinho.length} exame${itensCarrinho.length > 1 ? "s" : ""}`}
          >
            Solicitar
          </Button>
        </div>
      ) : null}

      {tenantId ? (
        <SolicitacaoModal
          open={open}
          onClose={() => setOpen(false)}
          tenantId={tenantId}
          itens={itensCarrinho}
          total={total}
          mostrarPreco={mostrarPreco}
          onRemove={(id) => setCarrinho((prev) => { const n = { ...prev }; delete n[id]; return n; })}
          onSuccess={() => { setCarrinho({}); setOpen(false); }}
        />
      ) : null}
    </section>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  itens: ExamePublico[];
  total: number;
  mostrarPreco: boolean;
  onRemove: (exameId: string) => void;
  onSuccess: () => void;
}

function SolicitacaoModal({ open, onClose, tenantId, itens, total, mostrarPreco, onRemove, onSuccess }: ModalProps) {
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [obs, setObs] = useState("");
  const [tipo, setTipo] = useState<"laboratorio" | "domiciliar">("laboratorio");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [unidades, setUnidades] = useState<UnidadePublica[]>([]);
  const [autoFilled, setAutoFilled] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cpfDigits = sanitizeCPF(cpf);
  const cpfComplete = cpfDigits.length === 11;
  const cpfValid = cpfComplete && isValidCPF(cpfDigits);
  const cpfInvalid = cpfComplete && !cpfValid;

  // Carrega unidades quando o modal abre
  useEffect(() => {
    if (!open || !tenantId) return;
    let alive = true;
    (async () => {
      const us = await listUnidadesPublicas(tenantId);
      if (!alive) return;
      setUnidades(us);
      if (us.length === 1) setUnidadeId(us[0].id);
    })();
    return () => { alive = false; };
  }, [open, tenantId]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setCpf(""); setNome(""); setTelefone(""); setEmail("");
      setObs(""); setTipo("laboratorio"); setUnidadeId("");
      setAutoFilled(false);
    }
  }, [open]);

  // Lookup ao completar CPF válido
  useEffect(() => {
    if (!cpfValid || !tenantId) { setAutoFilled(false); return; }
    let alive = true;
    setLookingUp(true);
    (async () => {
      const p = await lookupPacientePorCpf(tenantId, cpfDigits);
      if (!alive) return;
      setLookingUp(false);
      if (p) {
        setNome(p.nome ?? "");
        const tel = p.celular || p.telefone || "";
        if (tel) setTelefone(formatPhone(tel));
        if (p.email) setEmail(p.email);
        setAutoFilled(true);
      } else {
        setAutoFilled(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cpfValid, cpfDigits, tenantId]);

  const handleSubmit = async () => {
    const phoneDigits = telefone.replace(/\D/g, "");
    if (!cpfValid) { toast.error("Informe um CPF válido"); return; }
    if (nome.trim().length < 2) { toast.error("Informe seu nome"); return; }
    if (phoneDigits.length < 10) { toast.error("Informe um telefone válido"); return; }
    if (itens.length === 0) { toast.error("Selecione pelo menos um exame"); return; }
    if (tipo === "laboratorio" && unidades.length > 0 && !unidadeId) {
      toast.error("Escolha a unidade do laboratório");
      return;
    }

    setEnviando(true);
    const res = await submitSolicitacaoPublica({
      tenant_id: tenantId,
      nome,
      telefone: phoneDigits,
      cpf: cpfDigits,
      observacao: [
        email ? `E-mail: ${email}` : "",
        obs.trim(),
      ].filter(Boolean).join("\n"),
      exames: itens.map((e) => ({ exame_id: e.exame_id, nome: e.nome, valor: e.valor })),
      total_estimado: total,
      tipo_atendimento: tipo,
      unidade_id: tipo === "laboratorio" ? (unidadeId || null) : null,
    });
    setEnviando(false);
    if (res.ok) {
      toast.success("Solicitação enviada!", { description: "Em breve entraremos em contato." });
      onSuccess();
    } else {
      toast.error(res.error ?? "Erro ao enviar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !enviando) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-border/60 flex flex-col w-screen h-[100dvh] max-w-none rounded-none sm:w-[calc(100vw-2rem)] sm:h-auto sm:max-w-2xl sm:max-h-[92vh] sm:rounded-2xl motion-safe:animate-scale-in motion-safe:duration-200 [&>button.absolute]:hidden"
      >
        <DialogHeader className="px-4 sm:px-7 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border/60 shrink-0 text-left relative">
          <div className="pr-12">
            <DialogTitle className="text-base sm:text-xl font-semibold tracking-tight">Solicitar exames</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Preencha seus dados e escolha como prefere realizar a coleta.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Fechar modal"
            className="absolute top-3 right-3 sm:top-4 sm:right-4 h-10 w-10 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </DialogHeader>

        {/* Resumo compacto sticky — visível principalmente no mobile */}
        {itens.length > 0 ? (
          <div
            className="sm:hidden shrink-0 border-b border-border/60 bg-muted/40 px-4 py-2 flex items-center justify-between gap-3"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="flex items-center gap-2 min-w-0">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <span className="text-xs font-medium text-foreground truncate">
                {itens.length} exame{itens.length > 1 ? "s" : ""} selecionado{itens.length > 1 ? "s" : ""}
              </span>
            </div>
            {mostrarPreco && total > 0 ? (
              <span className="text-xs font-semibold tabular-nums text-foreground whitespace-nowrap">{formatBRL(total)}</span>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-7 py-4 sm:py-5 space-y-4 sm:space-y-5">
          {/* CPF com validação */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              CPF <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(formatCPFInput(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`h-11 pr-10 ${cpfInvalid ? "border-destructive focus-visible:ring-destructive/40" : cpfValid ? "border-success/60 focus-visible:ring-success/30" : ""}`}
                aria-invalid={cpfInvalid}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {lookingUp ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : cpfValid ? (
                  <Check className="h-4 w-4 text-success" />
                ) : cpfInvalid ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : null}
              </div>
            </div>
            {cpfInvalid ? (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> CPF inválido. Confira os dígitos.
              </p>
            ) : autoFilled ? (
              <p className="text-xs text-success flex items-center gap-1">
                <Check className="h-3 w-3" /> Cadastro encontrado — dados preenchidos.
              </p>
            ) : null}
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nome completo <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={120}
              className="h-11"
              disabled={!cpfValid}
              placeholder={!cpfValid ? "Informe o CPF primeiro" : ""}
            />
          </div>

          {/* Telefone + e-mail */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Telefone <span className="text-destructive">*</span>
              </Label>
              <Input
                inputMode="tel"
                value={telefone}
                onChange={(e) => setTelefone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={16}
                className="h-11"
                disabled={!cpfValid}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mail <span className="text-muted-foreground/60 normal-case font-normal tracking-normal">(opcional)</span>
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                maxLength={120}
                className="h-11"
                disabled={!cpfValid}
              />
            </div>
          </div>

          {/* Tipo de atendimento */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Onde deseja realizar?
            </Label>
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("laboratorio")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${tipo === "laboratorio" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-border/80 hover:bg-muted/40"}`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tipo === "laboratorio" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">No laboratório</p>
                  <p className="text-[11px] text-muted-foreground">Compareça à unidade</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTipo("domiciliar")}
                className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${tipo === "domiciliar" ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-border/80 hover:bg-muted/40"}`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${tipo === "domiciliar" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Home className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Coleta domiciliar</p>
                  <p className="text-[11px] text-muted-foreground">Vamos até você</p>
                </div>
              </button>
            </div>
          </div>

          {/* Seleção de unidade — só quando laboratório e há mais de 1 */}
          {tipo === "laboratorio" && unidades.length > 1 ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Escolha a unidade <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {unidades.map((u) => {
                  const sel = unidadeId === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setUnidadeId(u.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${sel ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:border-border/80 hover:bg-muted/40"}`}
                    >
                      <MapPin className={`h-4 w-4 mt-0.5 shrink-0 ${sel ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{u.nome}</p>
                        {(u.endereco || u.cidade) ? (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {[u.endereco, u.cidade, u.estado].filter(Boolean).join(" — ")}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Observações <span className="text-muted-foreground/60 normal-case font-normal tracking-normal">(opcional)</span>
            </Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={tipo === "domiciliar" ? "Endereço para coleta, melhor horário, etc." : "Qualquer detalhe que ajude no atendimento"}
              className="resize-none"
            />
          </div>

          {/* Resumo */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Você selecionou ({itens.length})
            </p>
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {itens.map((e) => (
                <li key={e.exame_id} className="flex items-center justify-between text-xs gap-2 group">
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    <Check className="h-3 w-3 text-success shrink-0" /> {e.nome}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {mostrarPreco && e.valor > 0 ? (
                      <span className="text-muted-foreground tabular-nums">{formatBRL(e.valor)}</span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemove(e.exame_id)}
                      aria-label={`Remover ${e.nome}`}
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            {mostrarPreco && total > 0 ? (
              <div className="flex items-center justify-between text-sm font-semibold mt-3 pt-3 border-t border-border">
                <span>Total estimado</span>
                <span className="tabular-nums">{formatBRL(total)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="px-4 sm:px-7 py-3 sm:py-4 border-t border-border/60 bg-muted/20 shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" onClick={onClose} disabled={enviando} className="w-full sm:w-auto h-11">
            <X className="h-4 w-4 mr-1.5" /> Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={enviando || !cpfValid} className="w-full sm:w-auto h-11">
            {enviando ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Check className="h-4 w-4 mr-1.5" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatCPFInput(raw: string): string {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 9);
  const p4 = d.slice(9, 11);
  let out = p1;
  if (p2) out += "." + p2;
  if (p3) out += "." + p3;
  if (p4) out += "-" + p4;
  return out;
}

function formatPhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    // (00) 0000-0000
    const a = d.slice(0, 2), b = d.slice(2, 6), c = d.slice(6, 10);
    let out = "";
    if (a) out += "(" + a;
    if (a.length === 2) out += ") ";
    if (b) out += b;
    if (c) out += "-" + c;
    return out;
  }
  const a = d.slice(0, 2), b = d.slice(2, 7), c = d.slice(7, 11);
  return `(${a}) ${b}-${c}`;
}