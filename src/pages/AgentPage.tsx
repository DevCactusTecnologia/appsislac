// src/pages/AgentPage.tsx
// NOTE: Auditado em docs/ai-agent-1.0/ — módulo órfão e não-funcional.
// Mantido apenas para evitar regressão de typecheck até decisão de remoção.

import { ChatInterface } from "@/components/Agent/ChatInterface";
import { useAuth } from "@/contexts/AuthContext";

export default function AgentPage() {
  const { user } = useAuth();

  if (!user || !user.tenantId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">Carregando...</div>
      </div>
    );
  }

  return <ChatInterface tenantId={user.tenantId} userId={String(user.id)} />;
}
