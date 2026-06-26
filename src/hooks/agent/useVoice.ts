// src/hooks/agent/useVoice.ts

import { useState, useCallback } from 'react';

export function useVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string>();

  const startListening = useCallback((onResult: (text: string) => void) => {
    try {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || 
                                (window as any).SpeechRecognition;
      
      if (!SpeechRecognition) {
        setError('Reconhecimento de voz não suportado');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setListening(true);
      
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        onResult(transcript);
      };

      recognition.onerror = (event: any) => setError(`Erro: ${event.error}`);
      recognition.onend = () => setListening(false);

      recognition.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao iniciar reconhecimento');
    }
  }, []);

  const stopListening = useCallback(() => {
    setListening(false);
  }, []);

  const speak = useCallback((text: string, usePremium = false) => {
    setSpeaking(true);

    if (usePremium) {
      speakPremium(text).finally(() => setSpeaking(false));
    } else {
      speakDefault(text);
      setSpeaking(false);
    }
  }, []);

  return {
    listening,
    speaking,
    error,
    startListening,
    stopListening,
    speak,
  };
}

function speakDefault(text: string): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  speechSynthesis.speak(utterance);
}

async function speakPremium(text: string): Promise<void> {
  try {
    const apiKey = import.meta.env.VITE_ELEVENLABS_KEY;
    if (!apiKey) throw new Error('ElevenLabs API key not configured');

    const response = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB',
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) throw new Error('ElevenLabs error');

    const audio = new Audio(URL.createObjectURL(await response.blob()));
    audio.play();
  } catch (err) {
    console.error('Premium voice failed, using default', err);
    speakDefault(text);
  }
}
