import { Navigate } from "react-router-dom";
import { useRotinaColetaAnaliseEnabled } from "@/hooks/useRotinaConfig";

/**
 * Bloqueia o acesso às páginas "Registrar coleta" e "Analisar amostras"
 * quando o admin do laboratório desativou essas etapas em
 * Configurações → Fluxo / Rotina. Redireciona para /resultados.
 */
export const RotinaColetaAnaliseGuard = ({ children }: { children: React.ReactNode }) => {
  const enabled = useRotinaColetaAnaliseEnabled();
  if (!enabled) return <Navigate to="/resultados" replace />;
  return <>{children}</>;
};
