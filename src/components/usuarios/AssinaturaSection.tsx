import { useEffect, useRef, useState } from "react";
import { PenLine, Upload, X as XIcon, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  uploadAssinatura,
  removerAssinaturaImagem,
  fetchAssinaturaUrl,
} from "@/data/usuariosStore";

interface Props {
  userId: string;
  tipo: "carimbo" | "imagem";
  conselho: string;
  imagemKey: string | null;
  nome: string;
  onChangeTipo: (t: "carimbo" | "imagem") => void;
  onChangeConselho: (v: string) => void;
  onImagemChange: (key: string | null) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const idx = s.indexOf(",");
      resolve(idx >= 0 ? s.slice(idx + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

export default function AssinaturaSection({
  userId, tipo, conselho, imagemKey, nome,
  onChangeTipo, onChangeConselho, onImagemChange,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (imagemKey) {
      fetchAssinaturaUrl(userId).then((u) => { if (!cancelled) setUrl(u); });
    } else {
      setUrl(null);
    }
    return () => { cancelled = true; };
  }, [userId, imagemKey]);

  const handleFile = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem maior que 2 MB."); return; }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Use PNG ou JPEG."); return;
    }
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await uploadAssinatura({
        userId, filename: file.name, contentType: file.type, dataBase64: b64,
      });
      if (!r.ok) { toast.error(r.error || "Falha no upload"); return; }
      onImagemChange(r.key ?? null);
      toast.success("Assinatura enviada.");
    } finally { setBusy(false); }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      const r = await removerAssinaturaImagem(userId);
      if (!r.ok) { toast.error(r.error || "Falha ao remover"); return; }
      onImagemChange(null);
      toast.success("Imagem removida.");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Assinatura no laudo</Label>

      <div className="grid grid-cols-2 gap-2">
        {(["carimbo", "imagem"] as const).map((opt) => (
          <button
            type="button"
            key={opt}
            onClick={() => onChangeTipo(opt)}
            className={cn(
              "p-3 rounded-xl border text-left transition-colors",
              tipo === opt ? "border-primary/50 bg-primary/5" : "border-border/60 hover:bg-muted/40",
            )}
          >
            <div className="text-sm font-medium text-foreground">
              {opt === "carimbo" ? "Carimbo eletrônico" : "Imagem scaneada"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {opt === "carimbo"
                ? "Texto gerado com nome, conselho e data/hora."
                : "Faça upload da assinatura digitalizada (PNG/JPG)."}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Conselho profissional (opcional)</Label>
        <Input
          value={conselho}
          onChange={(e) => onChangeConselho(e.target.value)}
          placeholder="Ex.: CRBM/MG 12345"
          className="rounded-xl"
        />
      </div>

      {tipo === "imagem" && (
        <div className="rounded-xl border border-border/60 p-3 space-y-2">
          {url ? (
            <div className="flex items-center gap-3">
              <img src={url} alt="Assinatura" className="h-16 max-w-[200px] object-contain bg-white border border-border/40 rounded" />
              <div className="flex-1 text-[11px] text-muted-foreground truncate">{imagemKey}</div>
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="h-8 px-3 rounded-lg border border-border/60 text-xs hover:bg-muted/40 inline-flex items-center gap-1 disabled:opacity-50"
              >
                <XIcon className="h-3.5 w-3.5" /> Remover
              </button>
            </div>
          ) : (
            <div className="text-[11px] text-muted-foreground">
              Nenhuma imagem enviada. Recomendado: fundo branco, ~400×120px.
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-9 px-3 rounded-lg border border-border/60 text-xs hover:bg-muted/40 inline-flex items-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {url ? "Substituir imagem" : "Enviar imagem"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {tipo === "carimbo" && (
        <div className="rounded-xl border border-dashed border-border/60 p-3 text-center">
          <div className="text-sm font-semibold text-foreground">{nome || "Nome do analista"}</div>
          {conselho && <div className="text-[11px] text-muted-foreground">{conselho}</div>}
        </div>
      )}
    </div>
  );
}