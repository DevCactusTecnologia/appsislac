import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmarIdentidade } from "@/data/rastreabilidadeStore";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  pacienteNascimento?: string;
  pacienteCpf?: string;
  onConfirmed?: () => void;
}

const IDENTIFICADORES = [
  { id: "nome_completo", label: "Nome completo confirmado" },
  { id: "data_nascimento", label: "Data de nascimento confirmada" },
  { id: "cpf", label: "CPF confirmado" },
  { id: "documento_oficial", label: "Documento oficial apresentado" },
];

export default function ConfirmarIdentidadeDialog(p: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const selecionados = Object.keys(checks).filter(k => checks[k]);

  const onSave = async () => {
    if (selecionados.length < 2) { toast.error("Confirme ao menos 2 identificadores (RDC 978/2025)"); return; }
    setSaving(true);
    try {
      await confirmarIdentidade({
        atendimentoId: p.atendimentoId,
        protocolo: p.protocolo,
        pacienteNome: p.pacienteNome,
        identificadores: selecionados,
        observacao,
      });
      toast.success("Identidade confirmada");
      setChecks({}); setObservacao("");
      p.onOpenChange(false);
      p.onConfirmed?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao confirmar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[hsl(var(--status-success))]" />
            Confirmação de identidade
          </DialogTitle>
          <DialogDescription>
            Confirme ao menos 2 identificadores antes de coletar (RDC 978/2025).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-0.5">
            <div><strong>{p.pacienteNome}</strong></div>
            {p.pacienteNascimento && <div className="text-muted-foreground">Nasc.: {p.pacienteNascimento}</div>}
            {p.pacienteCpf && <div className="text-muted-foreground">CPF: {p.pacienteCpf}</div>}
          </div>
          <div className="space-y-2">
            {IDENTIFICADORES.map(item => (
              <label key={item.id} className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={!!checks[item.id]}
                  onCheckedChange={(v) => setChecks(c => ({ ...c, [item.id]: !!v }))}
                />
                {item.label}
              </label>
            ))}
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving || selecionados.length < 2}>
            {saving ? "Salvando..." : "Confirmar identidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}