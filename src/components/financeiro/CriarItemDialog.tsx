import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import StandardDialog from "@/components/ui/standard-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Texto descritivo da entidade (ex: "Tipo de despesa", "Destino do pagamento", "Forma de pagamento"). */
  entityLabel: string;
  /** Valor inicial pré-preenchido (geralmente o texto digitado no SearchableSelect). */
  initialValue?: string;
  /** Verifica se já existe um item com este nome (case/acentos insensíveis). */
  existsCheck: (nome: string) => boolean;
  /** Callback assíncrono para persistir. Recebe o nome trimmed. */
  onCreate: (nome: string) => Promise<void>;
}

const CriarItemDialog = ({ open, onClose, entityLabel, initialValue = "", existsCheck, onCreate }: Props) => {
  const [nome, setNome] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setNome(initialValue);
      setError(null);
      setSaving(false);
      // Foco no input após o modal abrir
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialValue]);

  const handleSave = async () => {
    const trimmed = nome.trim();
    if (!trimmed) {
      setError("Informe um nome.");
      return;
    }
    if (existsCheck(trimmed)) {
      setError(`Já existe um(a) ${entityLabel.toLowerCase()} com este nome.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate(trimmed);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardDialog
      open={open}
      onClose={() => { if (!saving) onClose(); }}
      icon={<Plus className="h-5 w-5 text-primary" />}
      title={`Novo ${entityLabel.toLowerCase()}`}
      subtitle="Cadastre um novo item para reutilizar em despesas"
      maxWidth="sm"
      footer={
        <>
          <Button variant="outline" className="rounded-2xl" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button className="rounded-2xl" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Nome <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={inputRef}
            value={nome}
            onChange={(e) => { setNome(e.target.value); if (error) setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
            placeholder={`Ex.: ${entityLabel === "Forma de pagamento" ? "Boleto bancário" : entityLabel === "Destino do pagamento" ? "Cartório" : "Manutenção predial"}`}
            maxLength={80}
            disabled={saving}
            className="rounded-xl h-10"
            aria-invalid={!!error}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </StandardDialog>
  );
};

export default CriarItemDialog;
