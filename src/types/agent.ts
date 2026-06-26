// Agent Types - Para adicionar em src/types/agent.ts

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'action' | 'report';
}

export interface AgentState {
  messages: AgentMessage[];
  loading: boolean;
  error?: string;
}

export interface AgentAction {
  type: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'PRINT';
  entity: string;
  data?: Record<string, any>;
  requiresConfirmation: boolean;
}

export interface VoiceState {
  listening: boolean;
  speaking: boolean;
  error?: string;
}

export interface EdgeFunctionRequest {
  prompt: string;
  tenant_id: string;
  user_id: string;
  user_role: string;
}

export interface EdgeFunctionResponse {
  resposta: string;
  dados?: Record<string, any>;
  acao?: AgentAction;
  error?: string;
}
