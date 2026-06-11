import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { registrarEntrega, type EntregaCanal } from "@/data/rastreabilidadeStore";
import { useSelectOptions } from "@/hooks/use-select-options";
import { SELECT_CATEGORIAS } from "@/data/selectOptionsStore";

/** Canais válidos para entrega de laudo. */
const ENTREGA_CANAIS_VALIDOS: EntregaCanal[] = ["presencial", "email", "whatsapp", "portal", "impresso", "outro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimentoId: number;
  protocolo: string;
  pacienteNome: string;
  atendimentoExameId?: number;
  onConfirmed?: () => void;
}

export default function RegistrarEntregaDialog(p: Props) {
  const [canal, setCanal] = useState<EntregaCanal>("presencial");
  const [destinatarioNome, setDestinatarioNome] = useState(p.pacienteNome ?? "");
  const [destinatarioContato, setDestinatarioContato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const { options: canaisDb } = useSelectOptions(SELECT_CATEGORIAS.CANAIS_COMUNICACAO);
  const canais = canaisDb
    .filter((c) => ENTREGA_CANAIS_VALIDOS.includes(c.valor as EntregaCanal))
    .map((c) => ({ value: c.valor as EntregaCanal, label: c.label }));

  const onSave = async () => {
    if (!destinatarioNome.trim()) { toast.error("Informe quem recebeu"); return; }
    setSaving(true);
    try {
      await registrarEntrega({
        atendimentoId: p.atendimentoId,
        atendimentoExameId: p.atendimentoExameId ?? null,
        protocolo: p.protocolo,
        pacienteNome: p.pacienteNome,
        canal, destinatarioNome, destinatarioContato, observacao,
      });
      toast.success("Entrega registrada");
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
            <Send className="h-5 w-5 text-primary" />
            Registrar entrega do laudo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Canal de entrega *</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as EntregaCanal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {canais.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destinatário (quem recebeu) *</Label>
            <Input value={destinatarioNome} onChange={(e) => setDestinatarioNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>Contato / Documento</Label>
            <Input value={destinatarioContato} onChange={(e) => setDestinatarioContato(e.target.value)} placeholder="CPF, telefone ou e-mail" />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Registrar entrega"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}