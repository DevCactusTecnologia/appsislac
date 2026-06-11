import { useEffect, useState } from "react";
import { ArrowDownUp, Save, ArrowDown, ArrowUp, Trash2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import StandardDialog from "@/components/ui/standard-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type Insumo,
  type Lote,
  type MovimentacaoTipo,
  registrarMovimentacao,
} from "@/data/estoqueStore";

interface Props {
  open: boolean;
  onClose: () => void;
  insumos: Insumo[];
  lotes: Lote[];
  insumoIdInicial?: string;
  loteIdInicial?: string;
  onSaved: () => void;
}

const TIPOS: {
  value: MovimentacaoTipo;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  { value: "saida", label: "Saída", hint: "Reduz a quantidade do lote (consumo)", icon: ArrowDown, tone: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20" },
  { value: "entrada", label: "Entrada extra", hint: "Adiciona quantidade ao lote existente", icon: ArrowUp, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "descarte", label: "Descarte", hint: "Remove material vencido/contaminado", icon: Trash2, tone: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20" },
  { value: "ajuste", label: "Ajuste", hint: "Diferença encontrada na contagem (positiva ou negativa)", icon: SlidersHorizontal, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20" },
];

export default function MovimentacaoDialog({ open, onClose, insumos, lotes, insumoIdInicial, loteIdInicial, onSaved }: Props) {
  const [tipo, setTipo] = useState<MovimentacaoTipo>("saida");
  const [insumoId, setInsumoId] = useState("");
  const [loteId, setLoteId] = useState("");
  const [quantidade, setQuantidade] = useState<number>(0);
  const [motivo, setMotivo] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo("saida");
      setInsumoId(insumoIdInicial ?? "");
      setLoteId(loteIdInicial ?? "");
      setQuantidade(0);
      setMotivo("");
      setObservacao("");
    }
  }, [open, insumoIdInicial, loteIdInicial]);

  const lotesDoInsumo = lotes.filter((l) => l.insumo_id === insumoId && l.status !== "descartado");
  const insumoSel = insumos.find((i) => i.id === insumoId);
  const loteSel = lotes.find((l) => l.id === loteId);

  async function handleSave() {
    if (!insumoId) return toast.error("Selecione o insumo");
    if (!quantidade || Number(quantidade) === 0) return toast.error("Quantidade é obrigatória");
    if (tipo !== "ajuste" && Number(quantidade) < 0) return toast.error("Quantidade deve ser positiva");

    setSaving(true);
    const res = await registrarMovimentacao({
      insumo_id: insumoId,
      lote_id: loteId || null,
      tipo,
      quantidade: Number(quantidade),
      motivo,
      observacao,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Erro ao registrar movimentação");
      return;
    }
    toast.success("Movimentação registrada");
    onSaved();
    onClose();
  }

  const tipoSel = TIPOS.find((t) => t.value === tipo);
  const loteObrigatorio = tipo === "saida" || tipo === "descarte";

  return (
    <StandardDialog
      open={open}
      onClose={onClose}
      icon={<ArrowDownUp className="h-5 w-5 text-primary" />}
      title="Nova movimentação"
      subtitle="Registre entradas, saídas, descartes ou ajustes de inventário."
      maxWidth="2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Registrando..." : "Registrar"}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-6">
        {/* Tipo de movimento */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tipo de movimento</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TIPOS.map((t) => {
              const ativo = tipo === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTipo(t.value)}
                  className={cn(
                    "flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-all",
                    ativo
                      ? "border-primary/50 bg-primary/5 shadow-[0_2px_12px_-6px_hsl(var(--primary)/0.4)]"
                      : "border-border/60 bg-card hover:border-border hover:bg-muted/30",
                  )}
                >
                  <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center", t.tone)}>
                    <t.icon className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-semibold text-foreground">{t.label}</p>
                </button>
              );
            })}
          </div>
          {tipoSel && (
            <p className="text-[11px] text-muted-foreground">{tipoSel.hint}</p>
          )}
        </section>

        <div className="h-px bg-border/50" />

        {/* Insumo + Lote */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Item movimentado</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Insumo <span className="text-destructive">*</span></Label>
              <Select value={insumoId} onValueChange={(v) => { setInsumoId(v); setLoteId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione um insumo" /></SelectTrigger>
                <SelectContent>
                  {insumos.filter((i) => i.ativo).map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">
                Lote {loteObrigatorio && <span className="text-destructive">*</span>}
              </Label>
              <Select value={loteId || "__none__"} onValueChange={(v) => setLoteId(v === "__none__" ? "" : v)} disabled={!insumoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem lote específico —</SelectItem>
                  {lotesDoInsumo.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.numero_lote} — val. {new Date(l.data_validade).toLocaleDateString("pt-BR")} — saldo {l.quantidade_atual}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(insumoSel || loteSel) && (
              <div className="col-span-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground space-y-0.5">
                {insumoSel && (
                  <p>Insumo: <span className="font-medium text-foreground">{insumoSel.nome}</span> ({insumoSel.unidade_medida})</p>
                )}
                {loteSel && (
                  <p>Lote selecionado: <span className="font-medium text-foreground">{loteSel.numero_lote}</span> · saldo atual <span className="font-semibold text-foreground tabular-nums">{loteSel.quantidade_atual}</span></p>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="h-px bg-border/50" />

        {/* Detalhes */}
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Detalhes</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Quantidade <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
              />
              {tipo === "ajuste" && <p className="text-[11px] text-muted-foreground">Use valor negativo para reduzir.</p>}
            </div>
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: consumo na rotina, descarte por vencimento..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground">Observação</Label>
              <Textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Detalhes adicionais sobre essa movimentação." />
            </div>
          </div>
        </section>
      </div>
    </StandardDialog>
  );
}
