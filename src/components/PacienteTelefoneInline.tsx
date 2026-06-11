import { useEffect, useState } from "react";
import { Phone, Pencil, Check, X } from "lucide-react";
import { getPacienteByCPF, updatePaciente, subscribePacientes } from "@/data/pacienteStore";
import { useToast } from "@/hooks/use-toast";

interface PacienteTelefoneInlineProps {
  /** CPF do paciente (com ou sem máscara) — usado para localizar e atualizar o registro */
  cpf: string;
  /** Telefone fallback caso o paciente não esteja no cadastro */
  fallbackTelefone?: string;
}

const formatPhoneDisplay = (raw: string): string => {
  const d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
};

const maskPhone = (raw: string): string => {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/**
 * Exibe inline o telefone do paciente (resolvido por CPF no pacienteStore).
 * Permite atualização rápida quando o telefone está desatualizado ou ausente.
 */
export default function PacienteTelefoneInline({ cpf, fallbackTelefone = "" }: PacienteTelefoneInlineProps) {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => subscribePacientes(() => setTick(t => t + 1)), []);

  const paciente = cpf ? getPacienteByCPF(cpf) : undefined;
  const telefoneAtual = paciente?.telefone || paciente?.celular || fallbackTelefone || "";

  const handleStartEdit = () => {
    setDraft(maskPhone(telefoneAtual));
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft("");
  };

  const handleSave = async () => {
    if (!paciente) {
      toast({
        title: "Paciente não encontrado",
        description: "Não foi possível atualizar o telefone porque o paciente não está no cadastro.",
        variant: "destructive",
      });
      return;
    }
    const digits = draft.replace(/\D/g, "");
    if (digits.length < 10) {
      toast({
        title: "Telefone inválido",
        description: "Informe um telefone com DDD (10 ou 11 dígitos).",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      updatePaciente(paciente.id, { telefone: maskPhone(draft) });
      toast({ title: "Telefone atualizado", description: "O contato do paciente foi atualizado." });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(maskPhone(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder="(00) 00000-0000"
          className="h-6 w-36 px-2 rounded border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="h-6 w-6 rounded flex items-center justify-center text-[hsl(var(--status-success))] hover:bg-[hsl(var(--status-success-bg))] disabled:opacity-50"
          title="Salvar telefone"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-accent"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="text-muted-foreground">Telefone:</span>
      {telefoneAtual ? (
        <span className="font-semibold text-foreground">{formatPhoneDisplay(telefoneAtual)}</span>
      ) : (
        <span className="font-semibold text-muted-foreground italic">não informado</span>
      )}
      <button
        type="button"
        onClick={handleStartEdit}
        className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
        title="Atualizar telefone"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}
