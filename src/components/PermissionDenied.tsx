// Página/seção de permissão negada — RBAC visual.
// Usado quando o frontend identifica que o usuário não possui a permissão
// necessária para uma ação. O backend revalida sempre via has_permission()
// (RLS / triggers / edge functions): este componente é apenas UX.
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  /** Permissão exigida (em snake_case) — exibida apenas como hint técnico. */
  permissao?: string;
  /** Mensagem amigável opcional. */
  mensagem?: string;
}

export default function PermissionDenied({ permissao, mensagem }: Props) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center">
        <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-destructive" />
        </div>
        <h1 className="text-base font-semibold text-foreground mb-1">
          Acesso não autorizado
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {mensagem ?? "Você não possui permissão para acessar este recurso. Fale com o administrador do laboratório."}
        </p>
        {permissao && (
          <p className="text-[11px] font-mono text-muted-foreground/70 mb-4">
            permissão exigida: {permissao}
          </p>
        )}
        <Link
          to="/atendimentos"
          className="inline-flex items-center justify-center h-9 px-4 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Voltar para atendimentos
        </Link>
      </div>
    </div>
  );
}