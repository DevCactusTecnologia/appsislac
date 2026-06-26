// src/hooks/agent/useAgent.ts

import { useState, useCallback } from 'react';
import { AgentMessage, AgentState } from '@/types/agent';

export function useAgent(tenantId: string, userId: string) {
  const [state, setState] = useState<AgentState>({
    messages: [],
    loading: false,
  });

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) return;

      const userMessage: AgentMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        loading: true,
        error: undefined,
      }));

      try {
        const response = await fetch('/functions/v1/chat-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            tenant_id: tenantId,
            user_id: userId,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Erro ao processar pergunta');
        }

        const { resposta, dados } = await response.json();

        const assistantMessage: AgentMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: resposta,
          timestamp: new Date(),
        };

        setState(prev => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          loading: false,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        setState(prev => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
      }
    },
    [tenantId, userId]
  );

  const clearMessages = useCallback(() => {
    setState({ messages: [], loading: false });
  }, []);

  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    sendMessage,
    clearMessages,
  };
}
