// Guard de rotas do Super Admin. Redireciona não-super-admins para /.

import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export default function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/super-admin/login" replace />;
  if (!user?.isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center px-6">
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            Esta área é exclusiva para administradores do SaaS.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
