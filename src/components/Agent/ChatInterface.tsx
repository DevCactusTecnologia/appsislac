// src/components/Agent/ChatInterface.tsx

import React, { useState } from 'react';
import { useAgent } from '@/hooks/agent/useAgent';
import { useVoice } from '@/hooks/agent/useVoice';
import { MessageCircle, Send, Mic, MicOff, Volume2 } from 'lucide-react';

interface ChatInterfaceProps {
  tenantId: string;
  userId: string;
}

export function ChatInterface({ tenantId, userId }: ChatInterfaceProps) {
  const [prompt, setPrompt] = useState('');
  const [usePremiumVoice, setUsePremiumVoice] = useState(false);
  const { messages, loading, error, sendMessage } = useAgent(tenantId, userId);
  const { listening, speak, startListening } = useVoice();

  const handleSend = async () => {
    if (!prompt.trim()) return;
    await sendMessage(prompt);
    setPrompt('');
  };

  const handleVoiceInput = () => {
    startListening((text) => {
      setPrompt(text);
      setTimeout(() => handleSend(), 500);
    });
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="flex items-center gap-2 p-4 border-b bg-blue-50">
        <MessageCircle className="w-5 h-5 text-blue-600" />
        <h2 className="font-semibold text-gray-900">Assistente de Laboratório</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-sm">Faça uma pergunta sobre seus dados</p>
            <p className="text-xs mt-2">Ex: "Quantos exames foram feitos hoje?"</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-900'
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => speak(msg.content, usePremiumVoice)}
                  className="mt-2 text-xs opacity-70 hover:opacity-100"
                >
                  <Volume2 className="w-3 h-3 inline" /> Ouvir
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
              <div className="animate-pulse">Processando...</div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-900 px-4 py-2 rounded-lg text-sm">
              ⚠️ {error}
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-4 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={usePremiumVoice}
            onChange={(e) => setUsePremiumVoice(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-gray-700">🎤 Voz Premium (ElevenLabs)</span>
          {usePremiumVoice && <span className="text-xs text-gray-500">~R$ 0.01</span>}
        </label>

        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Digite sua pergunta..."
            disabled={loading}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            rows={2}
          />

          <div className="flex flex-col gap-2">
            <button
              onClick={handleSend}
              disabled={loading || !prompt.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>

            <button
              onClick={handleVoiceInput}
              disabled={loading}
              className={`px-4 py-2 rounded-lg disabled:opacity-50 ${
                listening
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
              }`}
            >
              {listening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
