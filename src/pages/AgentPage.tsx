// src/pages/AgentPage.tsx

import { ChatInterface } from "@/components/Agent/ChatInterface";
import { useAuth } from "@/contexts/AuthContext";

export default function AgentPage() {
  const { user, currentTenant } = useAuth();
  
  if (!user || !currentTenant) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">Carregando...</div>
      </div>
    );
  }
  
  return (
    <ChatInterface 
      tenantId={currentTenant.id} 
      userId={user.id}
    />
  );
}
