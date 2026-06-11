/**
 * ProviderCatalogImporter — upload + import do XLSX do catálogo operacional
 * de um laboratório de apoio para `integration_provider_exams`.
 *
 * Não toca em `exames_catalogo` (canônico). Se a integration ainda não
 * existe, a edge function cria automaticamente em modo MOCK/inativa.
 */

import { useEffect, useRef, useState } from "react";
import { Upload, Loader2, CheckCircle2, XCircle, FileSpreadsheet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import type { IntegrationProvider } from "@/integrations/contracts/providers";

interface Props {
  provider: IntegrationProvider;
  providerLabel: string;
  integrationId: string | null;
  tenantId: string | null;
}

interface JobRow {
  id: string;
  status: "queued" | "processing" | "done" | "failed";
  progress: number;
  total_rows: number | null;
  total_exams: number | null;
  processed: number;
  errors: Array<{ code: string; message: string }> | null;
  message: string | null;
}

export const ProviderCatalogImporter = ({
  provider,
  providerLabel,
  integrationId,
  tenantId,
}: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"idle" | "uploading" | "parsing">("idle");
  const [job, setJob] = useState<JobRow | null>(null);
  const [count, setCount] = useState<number>(0);

  const refresh = async () => {
    if (!integrationId) {
      setCount(0);
      return;
    }
    const { count: c } = await supabase
      .from("integration_provider_exams")
      .select("id", { count: "exact", head: true })
      .eq("integration_id", integrationId);
    setCount(c ?? 0);
  };

  useEffect(() => {
    void refresh();
  }, [integrationId]);

  // Poll the active job until terminal state.
  useEffect(() => {
    if (!job?.id || job.status === "done" || job.status === "failed") return;
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("provider_catalog_import_jobs")
        .select("id, status, progress, total_rows, total_exams, processed, errors, message")
        .eq("id", job.id)
        .maybeSingle();
      if (!data) return;
      const j = data as unknown as JobRow;
      setJob(j);
      if (j.status === "done") {
        toast({ title: `${providerLabel} — catálogo importado`, description: `${j.total_exams ?? 0} exames • ${j.total_rows ?? 0} linhas` });
        setBusy("idle");
        await refresh();
      } else if (j.status === "failed") {
        toast({ title: "Falha no import", description: j.message ?? `${j.errors?.length ?? 0} erro(s)`, variant: "destructive" });
        setBusy("idle");
        await refresh();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status, providerLabel]);

  const handleFile = async (file: File) => {
    if (!tenantId) {
      toast({ title: "Tenant não resolvido", variant: "destructive" });
      return;
    }
    if (!/\.xlsx$/i.test(file.name)) {
      toast({ title: "Arquivo inválido", description: "Envie um .xlsx exportado do apoio.", variant: "destructive" });
      return;
    }
    setBusy("uploading");
    setJob(null);
    try {
      const path = `${tenantId}/${provider.toLowerCase()}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase
        .storage
        .from("provider-catalog-imports")
        .upload(path, file, { upsert: false, contentType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      if (upErr) throw upErr;

      setBusy("parsing");
      const { data, error } = await supabase.functions.invoke("provider-catalog-import", {
        body: {
          provider,
          storage_path: path,
          integration_id: integrationId ?? undefined,
        },
      });
      if (error) throw error;
      const job_id = (data as { job_id?: string })?.job_id;
      if (!job_id) throw new Error("job_id ausente");
      setJob({ id: job_id, status: "queued", progress: 0, total_rows: null, total_exams: null, processed: 0, errors: [], message: null });
      toast({ title: "Import enfileirado", description: "Processando em background…" });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      setJob(null);
      toast({ title: "Falha no import", description: msg, variant: "destructive" });
      setBusy("idle");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <FileSpreadsheet className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground">
            Catálogo operacional — {providerLabel}
          </div>
          <div className="text-xs text-muted-foreground">
            {count > 0
              ? `${count.toLocaleString("pt-BR")} exames do apoio importados`
              : "Importe o XLSX exportado pelo laboratório para mapear códigos."}
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy !== "idle" || (!!job && job.status !== "done" && job.status !== "failed")}
        >
          {busy === "uploading" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</>
          ) : job && job.status !== "done" && job.status !== "failed" ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processando… {job.progress}%</>
          ) : (
            <><Upload className="h-4 w-4" /> Importar catálogo (XLSX)</>
          )}
        </Button>
        {job && (job.status === "done" || job.status === "failed") && (
          <span
            className={
              "text-xs flex items-center gap-1.5 " +
              (job.status === "done" ? "text-emerald-600" : "text-rose-600")
            }
          >
            {job.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {job.status === "done"
              ? `${job.processed ?? 0} exames processados`
              : `Falha: ${job.errors?.[0]?.message ?? job.message ?? "erro"}`}
          </span>
        )}
      </div>
    </div>
  );
};