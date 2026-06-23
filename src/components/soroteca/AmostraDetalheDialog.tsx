// Dialog com dados completos da amostra: paciente, atendimento, exames vinculados,
import { resolveMaterialNome } from "@/data/materiaisAmostraStore";
// histórico de status e auditoria. Aberto ao clicar em uma linha da Soroteca.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  SorotecaDialogHeader,
  SorotecaDialogBody,
} from "@/components/soroteca/SorotecaDialogShell";
import {
  Barcode,
  MapPin,
  Clock,
  User,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
  Microscope,
  PlusCircle,
  ClipboardList,
  History,
  Printer,
  Send,
  PackageCheck,
  PackageOpen,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type Amostra,
  type AmostraStatus,
  type AmostraDetalhe,
  type AmostraEvento,
  getAmostraDetalhe,
} from "@/data/sorotecaStore";
import { Button } from "@/components/ui/button";
import { imprimirEtiquetaAmostra } from "@/lib/etiquetaAmostra";
import { toast } from "sonner";


interface Props {
  amostraId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtData(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function idadeAnos(iso: string | null | undefined): string {
  if (!iso) return "";
  const nasc = new Date(iso);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return `${anos} anos`;
}

const STATUS_STYLE: Record<AmostraStatus, { bg: string; text: string; label: string }> = {
  DISPONIVEL: { bg: "bg-emerald-500/10 border-emerald-500/20", text: "text-emerald-600", label: "Disponível" },
  UTILIZADA: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-600", label: "Utilizada" },
  VENCIDA: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600", label: "Vencida" },
  DESCARTADA: { bg: "bg-muted border-border", text: "text-muted-foreground", label: "Descartada" },
};

function eventoIcon(tipo: AmostraEvento["tipo"]) {
  const map: Record<AmostraEvento["tipo"], React.ReactNode> = {
    CRIACAO: <PlusCircle className="w-3.5 h-3.5" />,
    STATUS: <AlertTriangle className="w-3.5 h-3.5" />,
    REUTILIZACAO: <RefreshCw className="w-3.5 h-3.5" />,
    ANALISE: <Microscope className="w-3.5 h-3.5" />,
    LIBERACAO: <CheckCircle2 className="w-3.5 h-3.5" />,
    DESCARTE: <XCircle className="w-3.5 h-3.5" />,
    AUDITORIA: <ClipboardList className="w-3.5 h-3.5" />,
  };
  return map[tipo];
}

function eventoCor(tipo: AmostraEvento["tipo"]) {
  const map: Record<AmostraEvento["tipo"], string> = {
    CRIACAO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    STATUS: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    REUTILIZACAO: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    ANALISE: "bg-violet-500/10 text-violet-600 border-violet-500/30",
    LIBERACAO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    DESCARTE: "bg-red-500/10 text-red-600 border-red-500/30",
    AUDITORIA: "bg-muted text-muted-foreground border-border",
  };
  return map[tipo];
}

export default function AmostraDetalheDialog({ amostraId, open, onOpenChange }: Props) {
  const [detalhe, setDetalhe] = useState<AmostraDetalhe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!amostraId || !open) {
      setDetalhe(null);
      return;
    }
    setLoading(true);
    getAmostraDetalhe(amostraId).then((d) => {
      if (!alive) return;
      setDetalhe(d);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [amostraId, open]);

  const a = detalhe?.amostra;
  const status = a ? STATUS_STYLE[a.status] : null;

  const handleImprimirEtiqueta = () => {
    if (!a) return;
    try {
      imprimirEtiquetaAmostra({
        codigoBarra: a.codigo_barra,
        protocoloAtendimento: detalhe?.atendimento?.protocolo,
        pacienteNome: detalhe?.paciente?.nome,
        pacienteIdade: detalhe?.paciente?.nascimento
          ? idadeAnos(detalhe.paciente.nascimento)
          : undefined,
        material: resolveMaterialNome(a.material_id),
        dataColeta: a.data_coleta,
        observacao: a.observacao || undefined,
      });
    } catch (err) {
      // Erro silenciado — toast abaixo já comunica ao usuário.
      void err;
      toast.error("Não foi possível imprimir a etiqueta.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0">
        <SorotecaDialogHeader
          icon={Barcode}
          title={
            <span className="flex items-center gap-2">
              Detalhes da amostra
              {a && (
                <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                  {a.codigo_barra}
                </span>
              )}
            </span>
          }
          description="Rastreabilidade completa: paciente, exames vinculados, validade e histórico."
          right={
            a && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimirEtiqueta}
                className="shrink-0"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Etiqueta
              </Button>
            )
          }
        />

        {loading ? (
          <SorotecaDialogBody>
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          </SorotecaDialogBody>
        ) : !detalhe || !a || !status ? (
          <SorotecaDialogBody>
            <div className="py-12 text-center text-sm text-muted-foreground">
              Amostra não encontrada.
            </div>
          </SorotecaDialogBody>
        ) : (
          <SorotecaDialogBody className="space-y-5">

            {/* Cabeçalho da amostra */}
            <div className={cn("rounded-2xl border p-4", status.bg)}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-foreground/70" />
                    <span className="font-mono text-base font-bold text-foreground">
                      {a.codigo_barra}
                    </span>
                    {detalhe.terceirizado.isTerceirizado && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-violet-500/10 text-violet-600 border border-violet-500/30 flex items-center gap-1">
                        <Send className="w-2.5 h-2.5" />
                        Terceirizado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/80 mt-1">
                    Material: <span className="font-medium">{resolveMaterialNome(a.material_id) || "—"}</span>
                  </p>
                  {detalhe.atendimento && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Vinculada ao atendimento
                      </span>
                      <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {detalhe.atendimento.protocolo}
                      </span>
                      {detalhe.paciente && (
                        <span className="text-xs text-foreground/70">
                          • {detalhe.paciente.nome}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border",
                    status.bg,
                    status.text,
                  )}
                >
                  {status.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
                <div>
                  <p className="text-muted-foreground">Coleta</p>
                  <p className="font-medium text-foreground mt-0.5">{fmt(a.data_coleta)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Validade</p>
                  <p className="font-medium text-foreground mt-0.5">{fmt(a.data_validade)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Localização
                  </p>
                  <p className="font-mono font-medium text-foreground mt-0.5">
                    {a.localizacao || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Atualizada em
                  </p>
                  <p className="font-medium text-foreground mt-0.5">{fmt(a.updated_at)}</p>
                </div>
              </div>

              {a.observacao && (
                <div className="mt-3 pt-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground">Observação</p>
                  <p className="text-sm text-foreground/80 mt-1">{a.observacao}</p>
                </div>
              )}
            </div>

            {/* Paciente + Atendimento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <section className="rounded-2xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <User className="w-4 h-4 text-primary" />
                  Paciente
                </h3>
                {detalhe.paciente ? (
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Nome</dt>
                      <dd className="font-medium text-foreground text-right">
                        {detalhe.paciente.nome}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">CPF</dt>
                      <dd className="font-mono text-foreground">{detalhe.paciente.cpf || "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Nascimento</dt>
                      <dd className="text-foreground">
                        {fmtData(detalhe.paciente.nascimento)}
                        {detalhe.paciente.nascimento && (
                          <span className="text-muted-foreground ml-1">
                            ({idadeAnos(detalhe.paciente.nascimento)})
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Sexo</dt>
                      <dd className="text-foreground capitalize">
                        {detalhe.paciente.sexo || "—"}
                      </dd>
                    </div>
                  </dl>
                ) : detalhe.atendimento?.paciente_nome ? (
                  <>
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Nome</dt>
                        <dd className="font-medium text-foreground text-right">
                          {detalhe.atendimento.paciente_nome}
                        </dd>
                      </div>
                      {detalhe.atendimento.paciente_cpf && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">CPF</dt>
                          <dd className="font-mono text-foreground">
                            {detalhe.atendimento.paciente_cpf}
                          </dd>
                        </div>
                      )}
                      {detalhe.atendimento.paciente_nascimento && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Nascimento</dt>
                          <dd className="text-foreground">
                            {fmtData(detalhe.atendimento.paciente_nascimento)}
                            <span className="text-muted-foreground ml-1">
                              ({idadeAnos(detalhe.atendimento.paciente_nascimento)})
                            </span>
                          </dd>
                        </div>
                      )}
                    </dl>
                    <p className="text-[11px] text-amber-600 mt-3 flex items-start gap-1.5">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      Dados extraídos do atendimento — paciente não está vinculado ao cadastro.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Paciente não vinculado.
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  Atendimento de origem
                </h3>
                {detalhe.atendimento ? (
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Protocolo</dt>
                      <dd className="font-mono font-medium text-foreground">
                        {detalhe.atendimento.protocolo}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Data</dt>
                      <dd className="text-foreground">{fmt(detalhe.atendimento.data)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd className="text-foreground">{detalhe.atendimento.status_atendimento}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Convênio</dt>
                      <dd className="text-foreground">{detalhe.atendimento.convenio_nome}</dd>
                    </div>
                    {detalhe.atendimento.solicitante && (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Solicitante</dt>
                        <dd className="text-foreground">{detalhe.atendimento.solicitante}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Atendimento não vinculado.
                  </p>
                )}
              </section>
            </div>

            {/* Reserva para envio (exame terceirizado) */}
            {detalhe.terceirizado.isTerceirizado && (
              <section className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                  <Send className="w-4 h-4 text-violet-600" />
                  Exame terceirizado
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-violet-500/15 text-violet-600 border border-violet-500/30">
                    {detalhe.terceirizado.statusEnvio === "AGUARDANDO_ENVIO" && "Reservada para envio"}
                    {detalhe.terceirizado.statusEnvio === "ENVIADO" && "Enviada ao laboratório"}
                    {detalhe.terceirizado.statusEnvio === "RETORNADO" && "Resultado retornado"}
                  </span>
                </h3>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Laboratório de apoio</dt>
                    <dd className="font-medium text-foreground text-right">
                      {detalhe.terceirizado.labApoioNome || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground flex items-center gap-1">
                      <PackageOpen className="w-3 h-3" />
                      Data de envio
                    </dt>
                    <dd className="text-foreground">
                      {detalhe.terceirizado.dataEnvio
                        ? fmt(detalhe.terceirizado.dataEnvio)
                        : "Aguardando envio"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground flex items-center gap-1">
                      <PackageCheck className="w-3 h-3" />
                      Data de retorno
                    </dt>
                    <dd className="text-foreground">
                      {detalhe.terceirizado.dataRetorno
                        ? fmt(detalhe.terceirizado.dataRetorno)
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {detalhe.terceirizado.statusEnvio === "AGUARDANDO_ENVIO" && (
                  <p className="mt-3 text-[11px] text-violet-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                    Esta amostra está reservada e não pode ser reutilizada até ser enviada e processada pelo laboratório de apoio.
                  </p>
                )}
              </section>
            )}

            {/* Exames vinculados */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Activity className="w-4 h-4 text-primary" />
                Exames vinculados
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({detalhe.exames.length})
                </span>
              </h3>
              {detalhe.agrupamento.totalExames > 1 && (
                <div className="mb-3 p-2.5 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-start gap-2">
                  <Layers className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-foreground/80">
                    <span className="font-semibold">Mesmo tubo, múltiplos exames.</span>{" "}
                    Esta amostra física atende{" "}
                    <span className="font-semibold">{detalhe.agrupamento.totalExames} exames</span>{" "}
                    ({detalhe.agrupamento.examesOriginais} original
                    {detalhe.agrupamento.examesOriginais !== 1 ? "is" : ""}
                    {detalhe.agrupamento.examesReuso > 0 &&
                      `, ${detalhe.agrupamento.examesReuso} por reaproveitamento`}
                    ) — agrupados pelo material{" "}
                    <span className="font-mono font-medium">
                      {resolveMaterialNome(a.material_id) || "—"}
                    </span>
                    .
                  </div>
                </div>
              )}
              {detalhe.exames.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum exame vinculado.</p>
              ) : (
                <ul className="space-y-2">
                  {detalhe.exames.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border border-border/40"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">
                            {e.nome_exame}
                          </span>
                          {e.is_reutilizacao && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 border border-blue-500/30 flex items-center gap-1">
                              <RefreshCw className="w-2.5 h-2.5" />
                              Reuso
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span className="font-mono">{e.protocolo}</span>
                          <span>•</span>
                          <span className="capitalize">{e.status}</span>
                          {e.analista && (
                            <>
                              <span>•</span>
                              <span>{e.analista}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-muted-foreground shrink-0">
                        <p>Coleta: {fmt(e.data_coleta)}</p>
                        {e.data_liberacao && <p>Liberado: {fmt(e.data_liberacao)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Histórico / auditoria */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4">
                <History className="w-4 h-4 text-primary" />
                Histórico e auditoria
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  ({detalhe.eventos.length})
                </span>
              </h3>
              {detalhe.eventos.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum evento registrado.</p>
              ) : (
                <ol className="relative border-l border-border/60 ml-2 space-y-4">
                  {detalhe.eventos.map((ev) => (
                    <li key={ev.id} className="ml-4 relative">
                      <span
                        className={cn(
                          "absolute -left-[26px] top-0.5 w-5 h-5 rounded-full border flex items-center justify-center",
                          eventoCor(ev.tipo),
                        )}
                      >
                        {eventoIcon(ev.tipo)}
                      </span>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{ev.titulo}</p>
                          {ev.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {ev.descricao}
                            </p>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {fmt(ev.data)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </SorotecaDialogBody>
        )}
      </DialogContent>
    </Dialog>
  );
}
