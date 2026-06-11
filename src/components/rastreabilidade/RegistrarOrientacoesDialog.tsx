import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { registrarOrientacoes } from "@/data/rastreabilidadeStore";
import { useDicionario } from "@/hooks/useDicionario";

/** Canais válidos para entrega de orientações pré-analíticas. */
const ORIENTACAO_CANAIS_VALIDOS = ["presencial", "impresso", "email", "whatsapp", "outro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  exames: string[];
  onConfirmed?: () => void;
}

const ITENS_PADRAO = [
  "Jejum mínimo conforme protocolo",
  "Suspensão temporária de medicamentos (se aplicável)",
  "Repouso e abstenção de atividade física",
  "Hidratação prévia adequada",
  "Coleta de amostras especiais (urina 24h, fezes, etc.)",
  "Preparo intestinal (se aplicável)",
  "Documento com foto e pedido médico",
];

export default function RegistrarOrientacoesDialog(p: Props) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [canal, setCanal] = useState("presencial");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const { options: canaisDb } = useSelectOptions(SELECT_CATEGORIAS.CANAIS_COMUNICACAO);
  const canais = canaisDb.filter((c) => ORIENTACAO_CANAIS_VALIDOS.includes(c.valor));

  const itensSelecionados = Object.keys(checks).filter(k => checks[k]);

  const onSave = async () => {
    if (itensSelecionados.length === 0) { toast.error("Marque ao menos um item orientado"); return; }
    setSaving(true);
    try {
      await registrarOrientacoes({
        atendimentoId: p.atendimentoId,
        protocolo: p.protocolo,
        pacienteNome: p.pacienteNome,
        exames: p.exames,
        itensOrientados: itensSelecionados,
        canal, observacao,
      });
      toast.success("Orientações registradas");
      setChecks({}); setObservacao("");
      p.onOpenChange(false);
      p.onConfirmed?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Registrar orientações pré-analíticas
          </DialogTitle>
          <DialogDescription>
            Itens entregues/orientados ao paciente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            {ITENS_PADRAO.map(item => (
              <label key={item} className="flex items-start gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={!!checks[item]}
                  onCheckedChange={(v) => setChecks(c => ({ ...c, [item]: !!v }))}
                  className="mt-0.5"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
          <div>
            <Label>Canal de entrega</Label>
            <Select value={canal} onValueChange={setCanal}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {canais.map((c) => (
                  <SelectItem key={c.valor} value={c.valor}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Registrar orientações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}