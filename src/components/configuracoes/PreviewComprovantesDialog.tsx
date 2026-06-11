import { useMemo, useState } from "react";
import { FileText, Receipt, ClipboardCheck, AlertTriangle } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { buildComprovanteHtml } from "@/lib/comprovantes";
import { getLabConfig } from "@/data/labConfigStore";

interface PreviewComprovantesDialogProps {
  open: boolean;
  onClose: () => void;
}

type Tipo = "pagamento" | "atendimento" | "comparecimento";

const tabs: { id: Tipo; label: string; icon: React.ElementType }[] = [
  { id: "pagamento", label: "Pagamento", icon: Receipt },
  { id: "atendimento", label: "Atendimento", icon: FileText },
  { id: "comparecimento", label: "Comparecimento", icon: ClipboardCheck },
];

const dadosFicticios = {
  protocolo: "2026-000123",
  data: new Date().toLocaleDateString("pt-BR"),
  paciente: {
    nome: "Maria das Dores Silva",
    cpf: "123.456.789-00",
    nascimento: "12/04/1985",
    idade: "40 anos",
  },
  convenio: "Particular",
  solicitante: "Dr. João Pereira (CRM 12345)",
  exames: [
    { nome: "Hemograma completo", material: "Sangue venoso", valor: 35 },
    { nome: "Glicemia de jejum", material: "Sangue venoso", valor: 18 },
    { nome: "TSH ultrassensível", material: "Sangue venoso", valor: 47 },
  ],
  pagamentos: [
    { tipo: "PIX", data: new Date().toLocaleDateString("pt-BR"), valor: 100 },
  ],
  totais: { subtotal: 100, desconto: 0, pago: 100, total: 100, saldo: 0 },
};

const PreviewComprovantesDialog = ({ open, onClose }: PreviewComprovantesDialogProps) => {
  const [tipo, setTipo] = useState<Tipo>("pagamento");

  // Recalcula sempre que abrir/trocar tipo — pega a versão mais recente do labConfig
  const html = useMemo(() => {
    if (!open) return "";
    return buildComprovanteHtml({ tipo, ...dadosFicticios });
  }, [open, tipo]);

  const lab = getLabConfig();
  const faltando: string[] = [];
  if (!lab.responsavelTecnico) faltando.push("Responsável Técnico");
  if (!lab.cnpj) faltando.push("CNPJ");
  if (!lab.cnes) faltando.push("CNES");
  if (!lab.endereco) faltando.push("Endereço");

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<FileText className="h-5 w-5 text-primary" />}
      title="Prévia dos comprovantes"
      subtitle="Renderizado com dados fictícios usando os dados atuais do laboratório"
      maxWidth="5xl"
      allowMaximize
    >
      <div className="flex flex-col h-full">
        {/* Tabs */}
        <div className="px-6 pt-2 pb-3 border-b border-border/50 bg-card">
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = t.id === tipo;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`flex items-center gap-2 px-4 h-9 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {faltando.length > 0 && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                Campos não preenchidos não aparecem no comprovante: <strong>{faltando.join(", ")}</strong>.
                Para validade legal completa, preencha-os antes de salvar.
              </p>
            </div>
          )}
        </div>

        {/* Preview area — A4 fit-to-width */}
        <div className="flex-1 overflow-auto bg-muted/30 p-6">
          <div
            className="mx-auto bg-white shadow-md"
            style={{
              width: "210mm",
              minHeight: "297mm",
              maxWidth: "100%",
              padding: "18mm",
              boxSizing: "border-box",
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>
    </StandardDialog>
  );
};

export default PreviewComprovantesDialog;