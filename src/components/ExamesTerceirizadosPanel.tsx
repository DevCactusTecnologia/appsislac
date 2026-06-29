import { useEffect, useRef, useState } from "react";
import { Building2, Zap, Upload, RefreshCw, Download, Check, FileText, ExternalLink, Loader2, AlertCircle, History, FileUp, FileCheck2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  callLabApoioAdapter,
  updateExameTerceirizado,
  type AtendimentoExameRow,
} from "@/data/atendimentoStore";
import { getLabsApoio } from "@/data/labApoioStore";
import { getExamesCatalogo } from "@/data/exameCatalogoStore";
import { getCachedTenantNome } from "@/lib/db/tenantResolver";
import ImpressaoLotePorLab from "@/components/ImpressaoLotePorLab";
import LabBadge from "@/components/LabBadge";
import IntegrationStatusBadge from "@/components/IntegrationStatusBadge";
import IntegrationWarningsList from "@/components/IntegrationWarningsList";
import AuditoriaIntegracaoDrawer from "@/components/AuditoriaIntegracaoDrawer";
import ResultadoPopup from "@/components/ResultadoPopup";
import { abrirLaudoResolvido } from "@/lib/laudoResolver";
import { resolveIntegrationWarnings } from "@/lib/integration/integrationStatus";
import { getLabConfig, subscribeLabConfig } from "@/data/labConfigStore";

interface Props {
  rows: AtendimentoExameRow[];
  onChanged: () => void;
}
/* Status enums centralizados em `resolveIntegrationStatus` /
   <IntegrationStatusBadge /> — não duplicar lógica aqui. */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ExamesTerceirizadosPanel = ({ rows, onChanged }: Props) => {
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const labs = getLabsApoio();
  const catalogo = getExamesCatalogo();
  const [auditOpen, setAuditOpen] = useState<AtendimentoExameRow | null>(null);
  const [overrideRow, setOverrideRow] = useState<AtendimentoExameRow | null>(null);
  const [overrideMotivo, setOverrideMotivo] = useState("");

  const terceirizados = rows.filter(r => r.tipo_processo === "TERCEIRIZADO");
  if (terceirizados.length === 0) return null;

  const setBusy = (id: number, v: boolean) => setLoading(prev => ({ ...prev, [id]: v }));

  const handleSend = async (row: AtendimentoExameRow) => {
    setBusy(row.id, true);
    const r = await callLabApoioAdapter("send", row.id);
    setBusy(row.id, false);
    if (r.ok) {
      toast.success(`Enviado ao laboratório (protocolo ${r.protocolo_externo}).`);
      onChanged();
    } else {
      toast.error(r.error || "Falha ao enviar para o laboratório.");
    }
  };

  const handleFetch = async (row: AtendimentoExameRow) => {
    setBusy(row.id, true);
    const r = await callLabApoioAdapter("fetch", row.id);
    setBusy(row.id, false);
    if (r.ok) {
      if (r.status_externo === "IMPORTADO") toast.success("Resultado importado com sucesso.");
      else toast.info("Lab informa que o exame ainda está em análise.");
      onChanged();
    } else {
      toast.error(r.error || "Falha ao consultar o laboratório.");
    }
  };

  const handleMarcarRecebido = async (row: AtendimentoExameRow) => {
    setBusy(row.id, true);
    const r = await updateExameTerceirizado(row.id, {
      status_externo: "FINALIZADO",
      status: "finalizado",
      resultado_importado: true,
      data_retorno: new Date().toISOString(),
      data_liberacao: new Date().toISOString(),
    });
    setBusy(row.id, false);
    if (r.ok) {
      toast.success("Marcado como recebido e liberado.");
      onChanged();
    } else {
      toast.error(r.error || "Falha ao marcar como recebido.");
    }
  };

  const handleUpload = async (row: AtendimentoExameRow, file: File) => {
    setBusy(row.id, true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const contentBase64 = btoa(bin);
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const filename = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const { data, error } = await supabase.functions.invoke("lab-apoio-upload-pdf", {
        body: { target: "resultado", atendimento_exame_id: row.id, filename, contentBase64 },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha no upload");
      toast.success(data.s3_mirrored ? "Resultado anexado (espelhado no S3)." : "Resultado anexado com sucesso.");
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload";
      toast.error(msg);
    } finally {
      setBusy(row.id, false);
    }
  };

  const handleDownload = async (row: AtendimentoExameRow) => {
    if (!row.arquivo_resultado_path) return;
    const { data, error } = await supabase.storage
      .from("resultados-externos")
      .createSignedUrl(row.arquivo_resultado_path, 60);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  /** Override manual do laudo PDF do laboratório de apoio.
   *  Sobrepõe o PDF automático na visualização do resultado. */
  const handleOverridePdf = async (row: AtendimentoExameRow, file: File, motivo: string) => {
    setBusy(row.id, true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      const contentBase64 = btoa(bin);
      const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const filename = safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const { data, error } = await supabase.functions.invoke("lab-apoio-upload-pdf", {
        body: {
          target: "override",
          atendimento_exame_id: row.id,
          filename, contentBase64,
          motivo: motivo.trim() || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha ao anexar PDF");
      toast.success(data.s3_mirrored
        ? "PDF do apoio anexado (espelhado no S3). Substitui o laudo automático."
        : "PDF do apoio anexado. Substitui o laudo automático.");
      setOverrideRow(null);
      setOverrideMotivo("");
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao anexar PDF";
      toast.error(msg);
    } finally {
      setBusy(row.id, false);
    }
  };

  const handleVerLaudo = async (row: AtendimentoExameRow) => {
    setBusy(row.id, true);
    const r = await abrirLaudoResolvido(row.id);
    setBusy(row.id, false);
    if (!r.ok) toast.error(r.error || "Falha ao abrir laudo.");
    else if (r.source === "none") toast.info("Laudo ainda indisponível.");
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Exames terceirizados</h2>
            <p className="text-[11px] text-muted-foreground">
              {terceirizados.length} {terceirizados.length === 1 ? "exame enviado" : "exames enviados"} para laboratório de apoio
            </p>
          </div>
        </div>

        {/* Fase 4 — impressão em lote por laboratório (no canto direito do header) */}
        <ImpressaoLotePorLab
          exames={terceirizados.map(r => ({
            atendimentoExameId: r.id,
            tipoProcesso: r.tipo_processo,
            labApoioId: r.lab_apoio_id,
            // No painel de terceirizados, mesmo sem amostra real geramos uma "guia de remessa".
            amostraId: (r as { amostra_id?: string | null }).amostra_id ?? null,
            nomeExame: r.nome_exame,
          }))}
          laboratorioPropriaNome={getCachedTenantNome()}
          compact
          permitirGuiaRemessa
        />
      </header>


      <div className="space-y-2">
        {terceirizados.map((row) => {
          const lab = labs.find(l => l.id === row.lab_apoio_id);
          const labNome = lab?.nome ?? "—";
          const isBusy = !!loading[row.id];
          const finalizado = row.status_externo === "IMPORTADO" || row.status_externo === "FINALIZADO";
          const cat = catalogo.find((c) => c.nome === row.nome_exame);
          const awaitingMs = row.data_envio && !row.data_retorno
            ? Date.now() - new Date(row.data_envio).getTime()
            : null;
          const warnings = resolveIntegrationWarnings(row, {
            catalogo: cat ? {
              tipoProcesso: cat.tipoProcesso,
              permiteEnvioApoio: cat.permiteEnvioApoio,
              providerIntegracao: cat.providerIntegracao,
              codigoExameApoio: cat.codigoExameApoio,
            } : null,
            awaitingMs,
          });

          return (
            <div key={row.id} className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <IntegrationWarningsList warnings={warnings} className="mb-3" />


              <div className="flex items-center gap-2 flex-wrap">
                <IntegrationStatusBadge row={row} />
                {row.integracao_ativa ? (
                  <>
                    {row.status_externo === "AGUARDANDO_ENVIO" && (
                      <button onClick={() => handleSend(row)} disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                        Enviar agora
                      </button>
                    )}
                    {(row.status_externo === "ENVIADO" || row.status_externo === "EM_ANALISE_LAB") && (
                      <button onClick={() => handleFetch(row)} disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-accent transition-colors disabled:opacity-50">
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Reconsultar
                      </button>
                    )}
                    {row.status_externo === "RESULTADO_RECEBIDO" && (
                      <button onClick={() => handleFetch(row)} disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        Importar resultado
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-foreground hover:bg-accent transition-colors cursor-pointer">
                      <Upload className="h-3 w-3" />
                      {row.arquivo_resultado_path ? "Substituir arquivo" : "Anexar resultado"}
                      <input type="file" accept="application/pdf,image/*" className="hidden"
                        disabled={isBusy}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(row, f); e.target.value = ""; }} />
                    </label>
                    {!finalizado && (
                      <button onClick={() => handleMarcarRecebido(row)} disabled={isBusy}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50">
                        {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        Marcar como recebido
                      </button>
                    )}
                  </>
                )}

                {row.arquivo_resultado_path && (
                  <button onClick={() => handleDownload(row)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                    <FileText className="h-3 w-3" /> Ver arquivo <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                )}

                {row.integracao_ativa && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVerLaudo(row)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <Eye className="h-3 w-3" /> Ver laudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverrideRow(row)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <FileUp className="h-3 w-3" /> PDF do apoio
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditOpen(row)}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <History className="h-3 w-3" /> Histórico
                    </button>
                  </>
                )}

                {row.pdf_override_url && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-warning/15 text-status-warning"
                    title={`Enviado em ${fmtDate(row.pdf_override_uploaded_at ?? null)}${row.pdf_override_motivo ? ` · ${row.pdf_override_motivo}` : ""}`}
                  >
                    <FileCheck2 className="h-2.5 w-2.5" /> LAUDO MANUAL
                  </span>
                )}
              </div>

              {!row.integracao_ativa && row.status_externo === "AGUARDANDO_ENVIO" && (
                <p className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3" />
                  Sem integração — anexe o resultado recebido pelo laboratório.
                </p>
              )}
            </div>
          );
        })}
      </div>

      <AuditoriaIntegracaoDrawer
        open={!!auditOpen}
        onOpenChange={(v) => !v && setAuditOpen(null)}
        atendimentoExameId={auditOpen?.id ?? null}
        nomeExame={auditOpen?.nome_exame}
        protocoloExterno={auditOpen?.protocolo_externo ?? null}
        labNome={labs.find((l) => l.id === auditOpen?.lab_apoio_id)?.nome}
        provider={auditOpen ? (catalogo.find((c) => c.nome === auditOpen.nome_exame)?.providerIntegracao ?? null) : null}
      />

      <ResultadoPopup
        open={!!overrideRow}
        onOpenChange={(v) => {
          if (!v) {
            setOverrideRow(null);
            setOverrideMotivo("");
          }
        }}
        variant="info"
        title="Anexar PDF do apoio"
        description={
          <>
            Substitui o laudo automático na visualização do resultado.
            <br />
            <span className="text-[11px] text-muted-foreground">
              {overrideRow?.nome_exame}
              {overrideRow?.protocolo_externo ? ` · ${overrideRow.protocolo_externo}` : ""}
            </span>
            {overrideRow?.pdf_override_url && (
              <>
                <br />
                <span className="text-[11px] text-status-warning">
                  Já existe PDF manual — o anterior será preservado em auditoria.
                </span>
              </>
            )}
          </>
        }
        footer={
          <>
            <button
              type="button"
              onClick={() => { setOverrideRow(null); setOverrideMotivo(""); }}
              className="h-9 px-4 rounded-lg text-xs font-medium border border-border text-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <label className="h-9 px-4 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Selecionar PDF
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && overrideRow) handleOverridePdf(overrideRow, f, overrideMotivo);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[11px] font-medium text-muted-foreground mb-1">
              Motivo (opcional)
            </span>
            <input
              type="text"
              value={overrideMotivo}
              onChange={(e) => setOverrideMotivo(e.target.value)}
              placeholder="Ex.: laudo corrigido pelo apoio"
              maxLength={200}
              className="w-full h-9 px-3 rounded-lg text-xs bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>
      </ResultadoPopup>
    </section>
  );
};

export default ExamesTerceirizadosPanel;
