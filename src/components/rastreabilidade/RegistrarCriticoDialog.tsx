import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { registrarCriticoComunicacao, type CriticoCanal } from "@/data/rastreabilidadeStore";
import { useSelectOptions } from "@/hooks/use-select-options";
import { SELECT_CATEGORIAS } from "@/data/selectOptionsStore";

/** Canais válidos para comunicação de crítico (ordem de exibição). */
const CRITICO_CANAIS_VALIDOS: CriticoCanal[] = ["telefone", "email", "whatsapp", "presencial", "outro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  atendimentoId: number;
  atendimentoExameId: number;
  protocolo: string;
  pacienteNome: string;
  exameNome: string;
  parametro?: string;
  valor?: string;
  faixaCritica?: string;
  onConfirmed?: () => void;
}

export default function RegistrarCriticoDialog(p: Props) {
  const [canal, setCanal] = useState<CriticoCanal>("telefone");
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [destinatarioContato, setDestinatarioContato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const { options: canaisDb } = useSelectOptions(SELECT_CATEGORIAS.CANAIS_COMUNICACAO);
  const canais = canaisDb
    .filter((c) => CRITICO_CANAIS_VALIDOS.includes(c.valor as CriticoCanal))
    .map((c) => ({ value: c.valor as CriticoCanal, label: c.label }));

  if (import.meta.env.DEV && canais.length === 0 && canaisDb.length > 0) {
    console.warn("[RegistrarCriticoDialog] Nenhum canal válido encontrado em select_options/canais_comunicacao");
  }

  const reset = () => {
    setCanal("telefone"); setDestinatarioNome(""); setDestinatarioContato(""); setObservacao("");
  };

  const onSave = async () => {
    if (!destinatarioNome.trim()) { toast.error("Informe o destinatário"); return; }
    setSaving(true);
    try {
      await registrarCriticoComunicacao({
        atendimentoId: p.atendimentoId,
        atendimentoExameId: p.atendimentoExameId,
        protocolo: p.protocolo,
        pacienteNome: p.pacienteNome,
        exameNome: p.exameNome,
        parametro: p.parametro ?? "",
        valor: p.valor ?? "",
        faixaCritica: p.faixaCritica ?? "",
        canal,
        destinatarioNome,
        destinatarioContato,
        observacao,
      });
      toast.success("Comunicação registrada");
      reset();
      p.onOpenChange(false);
      p.onConfirmed?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao registrar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={p.open} onOpenChange={(v) => { if (!v) reset(); p.onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--status-danger))]" />
            Comunicar valor crítico
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs space-y-1">
            <div><span className="text-muted-foreground">Paciente:</span> {p.pacienteNome}</div>
            <div><span className="text-muted-foreground">Exame:</span> {p.exameNome}</div>
            {p.parametro && <div><span className="text-muted-foreground">Parâmetro:</span> {p.parametro} = <strong>{p.valor}</strong> (crítico: {p.faixaCritica})</div>}
          </div>
          <div>
            <Label>Canal *</Label>
            <Select value={canal} onValueChange={(v) => setCanal(v as CriticoCanal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {canais.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Destinatário (quem foi avisado) *</Label>
            <Input value={destinatarioNome} onChange={(e) => setDestinatarioNome(e.target.value)} placeholder="Dr. João Silva" />
          </div>
          <div>
            <Label>Contato</Label>
            <Input value={destinatarioContato} onChange={(e) => setDestinatarioContato(e.target.value)} placeholder="(00) 00000-0000 ou e-mail" />
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Conduta tomada, recomendação, etc." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => p.onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Salvando..." : "Registrar comunicação"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}