import { useState } from "react";
import ResultadoPopup from "@/components/ResultadoPopup";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { validarCredenciaisAnalista } from "@/lib/validarCredenciaisAnalista";

interface AlterarResponsavelPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onConfirm: (nome: string, iniciais: string) => void;
}

const AlterarResponsavelPopup = ({
  open,
  onOpenChange,
  title = "Alterar Responsável",
  description = "Informe as credenciais do novo responsável.",
  onConfirm,
}: AlterarResponsavelPopupProps) => {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [validando, setValidando] = useState(false);

  const handleClose = (v: boolean) => {
    if (!v) {
      setEmail("");
      setSenha("");
      setErro("");
    }
    onOpenChange(v);
  };

  return (
    <ResultadoPopup
      open={open}
      onOpenChange={handleClose}
      variant="info"
      title={title}
      description={description}
    >
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium text-muted-foreground">E-mail</Label>
          <Input
            className="mt-1 rounded-lg"
            type="email"
            placeholder="analista@lab.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErro(""); }}
          />
        </div>
        <div>
          <Label className="text-xs font-medium text-muted-foreground">Senha</Label>
          <Input
            className="mt-1 rounded-lg"
            type="password"
            placeholder="••••••"
            value={senha}
            onChange={(e) => { setSenha(e.target.value); setErro(""); }}
          />
        </div>
        {erro && (
          <p className="text-sm text-status-danger font-medium">{erro}</p>
        )}
        <div className="flex items-center justify-between gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="flex-1 rounded-lg h-10"
          >
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              setValidando(true);
              const res = await validarCredenciaisAnalista(email, senha);
              setValidando(false);
              if (res.ok) {
                onConfirm(res.nome, res.iniciais);
                handleClose(false);
                toast.success(`Responsável alterado para ${res.nome}`);
              } else {
                setErro(res.error);
              }
            }}
            disabled={!email || !senha || validando}
            className="flex-1 rounded-lg h-10"
          >
            {validando ? "Validando..." : "Confirmar"}
          </Button>
        </div>
      </div>
    </ResultadoPopup>
  );
};

export default AlterarResponsavelPopup;
