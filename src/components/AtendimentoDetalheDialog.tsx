import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Building2, Stethoscope, FlaskConical, CreditCard, FileText, Receipt, ClipboardCheck, MapPin, Clock, Droplet, Microscope, CheckCircle2, XCircle, Percent, Banknote, QrCode, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import WhatsappActionButton from "@/components/whatsapp/WhatsappActionButton";
import WhatsappTimeline from "@/components/whatsapp/WhatsappTimeline";
import { getBestWhatsappAction } from "@/lib/whatsapp/getBestWhatsappAction";
import {
  DOCUMENT_ACTIONS,
  sendDocumentWhatsapp,
  type DocumentTab,
} from "@/lib/whatsapp/getWhatsappActionByDocument";

// ----------------------------------------------------------------------------
// SISLAC Document Ownership (IA-first semantics)
//   Lab Data  = institutional identity         (labConfigStore — SINGLE SOURCE)
//   Documents = reusable templates             (documentoTemplatesStore)
//   Receipts  = operational instances per atendimento  (this dialog)
// Never duplicate institutional ownership. Branding is always pulled from
// labConfigStore at render time via documentoRenderer.ts.
// ----------------------------------------------------------------------------
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { buildComprovanteHtml } from "@/lib/comprovantes";
import StatusBadge from "./StatusBadge";
import OrigemBadge from "./OrigemBadge";
import IntegrationStatusBadge from "./IntegrationStatusBadge";
import IntegrationWarningsList from "./IntegrationWarningsList";
import { resolveIntegrationWarnings } from "@/lib/integration/integrationStatus";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { printHtmlInHiddenFrame } from "@/lib/printHtml";
import PacienteTelefoneInline from "./PacienteTelefoneInline";
import type { MockAtendimento } from "@/data/types";
import { getUnidadeById } from "@/data/unidadeStore";
import { getPacienteByCPF } from "@/data/pacienteStore";
import { getAtendimentoExamesDB, type AtendimentoExameRow } from "@/data/atendimentoStore";
import { calculateExamPrice } from "@/domains/appointment/services/pricing";
import {
  ensureDocumentoTemplatesLoaded,
  subscribeDocumentoTemplates,
} from "@/data/documentoTemplatesStore";

import { fmtBRLNumber } from "@/lib/utils";
type ExameStatusDb = AtendimentoExameRow["status"];

const STATUS_META: Record<ExameStatusDb, { label: string; icon: typeof Clock; tone: string }> = {
  pendente: { label: "Pendente", icon: Clock, tone: "text-status-warning" },
  coletado: { label: "Coletado", icon: Droplet, tone: "text-status-info" },
  em_bancada: { label: "Em bancada", icon: Microscope, tone: "text-status-warning" },
  analisado: { label: "Analisado", icon: Microscope, tone: "text-status-teal" },
  em_analise: { label: "Em análise", icon: Microscope, tone: "text-status-purple" },
  finalizado: { label: "Finalizado", icon: CheckCircle2, tone: "text-status-success" },
  cancelado: { label: "Cancelado", icon: XCircle, tone: "text-status-danger" },
};

interface AtendimentoDetalheDialogProps {
  open: boolean;
  onClose: () => void;
  atendimento: MockAtendimento | null;
}

const AtendimentoDetalheDialog = ({ open, onClose, atendimento }: AtendimentoDetalheDialogProps) => {
  useBodyScrollLock(open && !!atendimento);
  const { user } = useAuth();
  const [whatsappRefresh, setWhatsappRefresh] = useState(0);
  // Aba ativa = fonte única da verdade para o documento exibido/enviado.
  const pagouAlgo = (atendimento?.pagamentosRealizados ?? []).length > 0;
  const [docTab, setDocTab] = useState<DocumentTab>(pagouAlgo ? "pagamento" : "atendimento");
  // Se o pagamento for adicionado/removido em runtime, mantém aba válida.
  useEffect(() => {
    if (!pagouAlgo && docTab === "pagamento") setDocTab("atendimento");
  }, [pagouAlgo, docTab]);

  const [exameStatusMap, setExameStatusMap] = useState<Record<string, ExameStatusDb>>({});
  const [exameRowMap, setExameRowMap] = useState<Record<string, AtendimentoExameRow>>({});
  // Tick para forçar re-render quando os templates de documento forem
  // recarregados ou editados.
  const [, setTemplatesTick] = useState(0);
  // Verifica se todos os exames foram liberados (decide template do WhatsApp).
  const todosLiberadosExames = atendimento
    ? (atendimento.exames ?? []).length > 0 &&
      (atendimento.exames ?? []).every((nome) => exameStatusMap[nome] === "finalizado")
    : false;

  useEffect(() => {
    if (!open) return;
    // Garante que o store de templates está carregado antes de gerar preview.
    ensureDocumentoTemplatesLoaded().then(() => setTemplatesTick((t) => t + 1));
    const unsub = subscribeDocumentoTemplates(() =>
      setTemplatesTick((t) => t + 1),
    );
    return unsub;
  }, [open]);

  useEffect(() => {
    if (!open || !atendimento) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getAtendimentoExamesDB(atendimento.protocolo);
        if (cancelled) return;
        const map: Record<string, ExameStatusDb> = {};
        const rowMap: Record<string, AtendimentoExameRow> = {};
        for (const r of rows) {
          map[r.nome_exame] = r.status;
          rowMap[r.nome_exame] = r;
        }
        setExameStatusMap(map);
        setExameRowMap(rowMap);
      } catch {
        if (!cancelled) { setExameStatusMap({}); setExameRowMap({}); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, atendimento?.protocolo]);

  const unidade = atendimento?.unidadeId ? getUnidadeById(atendimento.unidadeId) : undefined;
  // Resolve valor REAL e destino de cobrança a partir dos metadados persistidos (examesCobranca).
  // Fallback (atendimentos legados sem metadados): R$ 0 e cobrança "paciente".
  const examesComValor = (atendimento?.exames ?? []).map((nomeExame) => {
    const meta = atendimento?.examesCobranca?.find(c => c.nome === nomeExame);
    const valor = Number(meta?.valor) || 0;
    const valorTabela = calculateExamPrice({ nomeExame, convenioNome: atendimento?.convenio ?? "Particular" });
    const valorOriginal = Math.max(Number(meta?.valorOriginal) || 0, valor, valorTabela);
    return {
      nome: nomeExame,
      material: meta?.material ?? "Sangue",
      valor,
      valorOriginal,
      cobrancaDestino: meta?.cobrancaDestino ?? "paciente",
    };
  });

  // Totais — calculados sobre valor ORIGINAL (preço cheio); desconto = diferença.
  const subtotalPaciente = examesComValor
    .filter(e => e.cobrancaDestino === "paciente")
    .reduce((sum, e) => sum + e.valorOriginal, 0);
  const totalPacienteEfetivo = examesComValor
    .filter(e => e.cobrancaDestino === "paciente")
    .reduce((sum, e) => sum + e.valor, 0);
  const descontoPaciente = Math.max(0, Math.round((subtotalPaciente - totalPacienteEfetivo) * 100) / 100);
  const totalConvenio = examesComValor
    .filter(e => e.cobrancaDestino === "convenio")
    .reduce((sum, e) => sum + e.valor, 0);
  const totalPago = (atendimento?.pagamentosRealizados ?? []).reduce((sum, p) => sum + p.valor, 0);
  const saldoDevedor = Math.max(0, totalPacienteEfetivo - totalPago);

  const baseComprovante = atendimento ? {
    protocolo: atendimento.protocolo,
    data: atendimento.data,
    paciente: { nome: atendimento.nome, cpf: atendimento.cpf, nascimento: atendimento.nascimento, idade: atendimento.idade },
    convenio: atendimento.convenio,
    solicitante: atendimento.solicitante,
    unidade: unidade ? { nome: unidade.nome, endereco: unidade.endereco, cidade: unidade.cidade, estado: unidade.estado } : undefined,
    exames: examesComValor,
  } : null;

  const pacienteAtual = atendimento?.cpf ? getPacienteByCPF(atendimento.cpf) : undefined;
  const telefonePaciente = pacienteAtual?.telefone || pacienteAtual?.celular;

  const buildComprovanteData = (tipo: "pagamento" | "atendimento" | "comparecimento") => baseComprovante ? ({
    ...baseComprovante,
    tipo,
    pagamentos: atendimento?.pagamentosRealizados ?? [],
    totais: { subtotal: subtotalPaciente, desconto: descontoPaciente, pago: totalPago, total: totalPacienteEfetivo, saldo: saldoDevedor },
  }) : null;

  const tipoLabels: Record<"pagamento" | "atendimento" | "comparecimento", string> = {
    pagamento: "COMPROVANTE DE PAGAMENTO",
    atendimento: "COMPROVANTE DE ATENDIMENTO",
    comparecimento: "COMPROVANTE DE COMPARECIMENTO",
  };

  // Imprime comprovante diretamente — sem modal, sem pré-visualização.
  // Olhou. Entendeu. Simplificou.
  const imprimirComprovante = (tipo: "pagamento" | "atendimento" | "comparecimento") => {
    const data = buildComprovanteData(tipo);
    if (!data) return;
    const html = buildComprovanteHtml(data);
    printHtmlInHiddenFrame({
      html,
      frameId: "comprovante-print-frame",
      documentTitle: `${tipoLabels[tipo]} ${data.protocolo}`.trim(),
    });
  };

  // Enviar WhatsApp — contextual: a aba ativa define exatamente o documento
  // enviado. Sem dropdown, sem modal de confirmação, sem ambiguidade.
  const handleSendWhatsapp = async () => {
    if (!atendimento) return;
    const r = await sendDocumentWhatsapp(docTab, atendimento, {
      tenantId: user?.tenantId,
    });
    if (r.ok) {
      toast.success("WhatsApp enfileirado", {
        description: DOCUMENT_ACTIONS[docTab].title,
      });
      setWhatsappRefresh((n) => n + 1);
      return;
    }
    if (r.reason === "telefone_invalido") {
      toast.error("Sem telefone válido", { description: "Cadastre o telefone do paciente." });
    } else if (r.reason === "paciente_sem_cadastro") {
      toast.error("Paciente sem cadastro", { description: "Conclua o cadastro antes de enviar." });
    } else {
      toast.error("Não foi possível enviar", { description: r.reason ?? "Erro desconhecido" });
    }
    throw new Error(r.reason ?? "erro");
  };


  if (!open || !atendimento) return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] flex flex-col bg-card rounded-3xl border border-border shadow-[0_24px_80px_-12px_hsl(var(--foreground)/0.18)] overflow-hidden animate-scale-in">
        {/* Header (fixed inside flex column — não usa sticky para evitar
            colapso quando a área scrollable tem `min-h-0`). */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 bg-card border-b border-border/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight truncate">Detalhes do Atendimento</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{atendimento.protocolo} · {atendimento.data}</p>
              {atendimento.origem && atendimento.origem !== "INTERNO" && (
                <div className="mt-1.5">
                  <OrigemBadge origem={atendimento.origem} />
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Single scrollable area covering everything.
            `min-h-0` é essencial: sem ele, `flex-1` herda min-height: auto
            e a área cresce para o tamanho do conteúdo, estourando o
            max-h do diálogo (header e rodapé saem do viewport). */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-muted/30">
          {/* Documento contextual — a aba ativa define exatamente o que será
              exibido (Imprimir) e enviado (WhatsApp). Fonte única da verdade. */}
          <div className="bg-card px-5 sm:px-6 py-3 border-b border-border/50">
            <div role="tablist" aria-label="Documento" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(["pagamento", "atendimento", "comparecimento"] as const).map((doc) => {
                const meta = DOCUMENT_ACTIONS[doc];
                const Icon = doc === "pagamento" ? Receipt : doc === "atendimento" ? FileText : ClipboardCheck;
                const active = docTab === doc;
                const disabled = doc === "pagamento" && !pagouAlgo;
                return (
                  <button
                    key={doc}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={disabled}
                    onClick={() => setDocTab(doc)}
                    className={
                      "h-10 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 " +
                      (active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40") +
                      " disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
                    }
                  >
                    <Icon className={"h-3.5 w-3.5 " + (active ? "" : "text-primary")} />
                    <span className="truncate">{meta.tabLabel}</span>
                  </button>
                );
              })}
            </div>
            {/* Subtítulo de contexto — o operador entende imediatamente o documento ativo. */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Documento selecionado:{" "}
              <span className="font-semibold text-foreground">
                {DOCUMENT_ACTIONS[docTab].title}
              </span>
            </p>
            {/* Ações da aba ativa — Imprimir + Enviar contextual. */}
            <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => imprimirComprovante(docTab)}
                className="h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-muted/40 transition-all duration-200 inline-flex items-center gap-1.5"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Imprimir
              </button>
              <WhatsappActionButton
                onSendAsync={handleSendWhatsapp}
                responsive={false}
                idleLabel={DOCUMENT_ACTIONS[docTab].buttonLabel}
                title={`Enviar ${DOCUMENT_ACTIONS[docTab].title} pelo WhatsApp`}
              />
            </div>
          </div>


          {/* Body */}
          <div className="px-5 sm:px-6 py-5 space-y-5">
          {/* Paciente */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paciente</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 space-y-1">
              <p className="text-[13px] font-semibold text-foreground">{atendimento.nome}</p>
              <p className="text-[11px] text-muted-foreground">CPF: {atendimento.cpf}</p>
              <p className="text-[11px] text-muted-foreground">Nascimento: {atendimento.nascimento} · {atendimento.idade}</p>
              <div className="pt-1 text-[11px]">
                <PacienteTelefoneInline cpf={atendimento.cpf} fallbackTelefone={telefonePaciente} />
              </div>
            </div>
          </section>

          {/* Unidade */}
          {unidade && (
            <section>
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Unidade</h3>
              </div>
              <div className="rounded-2xl bg-card border border-border p-4">
                <p className="text-[13px] font-medium text-foreground">{unidade.nome}</p>
                <p className="text-[11px] text-muted-foreground">{unidade.endereco} · {unidade.cidade}/{unidade.estado}</p>
              </div>
            </section>
          )}

          {/* Convênio & Solicitante */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Convênio & Solicitante</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Convênio</span>
                <span className="text-[13px] font-medium text-foreground">{atendimento.convenio}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Solicitante</span>
                <span className="text-[13px] font-medium text-foreground">{atendimento.solicitante}</span>
              </div>
            </div>
          </section>

          {/* Exames */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Exames ({examesComValor.length})</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border divide-y divide-border">
              {examesComValor.map((exame, i) => {
                const status = exameStatusMap[exame.nome];
                const meta = status ? STATUS_META[status] : null;
                const Icon = meta?.icon;
                const isConvenio = exame.cobrancaDestino === "convenio";
                const row = exameRowMap[exame.nome];
                const isTerc = row?.tipo_processo === "TERCEIRIZADO";
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{exame.nome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-muted-foreground">{exame.material}</p>
                        {isConvenio && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className="text-[10px] font-medium text-status-info">Cobrado do convênio</span>
                          </>
                        )}
                        {meta && Icon && (
                          <>
                            <span className="text-[10px] text-muted-foreground/40">·</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.tone}`}>
                              <Icon className="h-2.5 w-2.5" strokeWidth={2.5} />
                              {meta.label}
                            </span>
                          </>
                        )}
                      </div>
                      {isTerc && row && (
                        <div className="mt-1.5">
                          <IntegrationStatusBadge row={row} compact />
                          <IntegrationWarningsList
                            className="mt-1.5"
                            warnings={resolveIntegrationWarnings(row, {
                              catalogo: (() => {
                                const c = getExamesCatalogo().find((x) => x.nome === row.nome_exame);
                                return c ? {
                                  tipoProcesso: c.tipoProcesso,
                                  permiteEnvioApoio: c.permiteEnvioApoio,
                                  providerIntegracao: c.providerIntegracao,
                                  codigoExameApoio: c.codigoExameApoio,
                                } : null;
                              })(),
                              awaitingMs: row.data_envio && !row.data_retorno
                                ? Date.now() - new Date(row.data_envio).getTime()
                                : null,
                            })}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[13px] font-semibold text-foreground">R$ {fmtBRLNumber(exame.valorOriginal)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Pagamento */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Status</span>
                <StatusBadge label={atendimento.statusPagamento.label} type={atendimento.statusPagamento.type} />
              </div>

              {((atendimento.pagamentosRealizados && atendimento.pagamentosRealizados.length > 0) || descontoPaciente > 0) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Pagamentos realizados</span>
                  {descontoPaciente > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--status-success) / 0.10)" }}>
                          <Percent className="h-3.5 w-3.5" style={{ color: "hsl(var(--status-success))" }} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[12px] font-medium text-foreground block leading-tight">Desconto</span>
                          <p className="text-[10px] text-muted-foreground leading-tight truncate">{atendimento.data}</p>
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color: "hsl(var(--status-success))" }}>− R$ {fmtBRLNumber(descontoPaciente)}</span>
                    </div>
                  )}
                  {atendimento.pagamentosRealizados?.map((p, i) => {
                    const Icon = p.tipo === "Dinheiro" ? Banknote : p.tipo === "PIX" ? QrCode : CreditCard;
                    return (
                      <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--status-success) / 0.10)" }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: "hsl(var(--status-success))" }} />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[12px] font-medium text-foreground block leading-tight">{p.tipo}</span>
                            <p className="text-[10px] text-muted-foreground leading-tight truncate">{p.data}</p>
                          </div>
                        </div>
                        <span className="text-[13px] font-semibold tabular-nums whitespace-nowrap" style={{ color: "hsl(var(--status-success))" }}>R$ {fmtBRLNumber(p.valor)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="border-t border-border pt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Subtotal (paciente)</span>
                  <span className="text-[13px] text-foreground">R$ {fmtBRLNumber(subtotalPaciente)}</span>
                </div>
                {descontoPaciente > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "hsl(var(--status-success))" }}>Desconto aplicado</span>
                    <span className="text-[13px] font-medium" style={{ color: "hsl(var(--status-success))" }}>− R$ {fmtBRLNumber(descontoPaciente)}</span>
                  </div>
                )}
                {totalConvenio > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-status-info">Cobrado do convênio</span>
                    <span className="text-[13px] text-status-info">R$ {fmtBRLNumber(totalConvenio)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">Valor pago</span>
                  <span className="text-[13px] font-medium" style={{ color: "hsl(var(--status-success))" }}>R$ {fmtBRLNumber(totalPago)}</span>
                </div>
                {saldoDevedor > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: "hsl(var(--status-warning))" }}>Saldo devedor</span>
                    <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--status-warning))" }}>R$ {fmtBRLNumber(saldoDevedor)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between font-bold">
                  <span className="text-[13px] text-foreground">Total devido pelo paciente</span>
                  <span className="text-[13px] text-foreground">R$ {fmtBRLNumber(totalPacienteEfetivo)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Status */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status do Atendimento</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4">
              <StatusBadge label={atendimento.statusAtendimento.label} type={atendimento.statusAtendimento.type} showIcon={atendimento.statusAtendimento.showIcon} tooltip={atendimento.motivoCancelamento} />
              {atendimento.motivoCancelamento && (
                <p className="text-[11px] mt-2" style={{ color: "hsl(var(--status-danger))" }}>Motivo: {atendimento.motivoCancelamento}</p>
              )}
            </div>
          </section>

          {/* WhatsApp — histórico de comunicação (Fase 3F.2) */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4 text-[hsl(142,70%,45%)]" />
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">WhatsApp</h3>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4">
              <WhatsappTimeline protocolo={atendimento.protocolo} refreshKey={whatsappRefresh} />
            </div>
          </section>
          </div>
        </div>
      </div>
    </div>
  ), document.body);
};

export default AtendimentoDetalheDialog;
