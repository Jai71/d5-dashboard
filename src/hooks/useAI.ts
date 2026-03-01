import { useState, useCallback, useRef } from 'react';
import type { ChatMessage, DataPoint, Settings, Metrics } from '../types';
import { AI_SAMPLE_POINTS, AI_MAX_HISTORY } from '../constants';

export interface AIState {
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  isLoading: boolean;
  clearMessages: () => void;
}

function buildSystemPrompt(
  settings: Settings,
  metrics: Metrics,
  sampledData: DataPoint[]
): string {
  return `You are the AI analysis engine for the D5 Smart Meter dashboard. You ONLY answer questions about the loaded dataset, the meter's control algorithm, energy metrics, battery management, load servicing, and renewable optimisation. If the user asks anything unrelated to the smart meter data or algorithm — politely decline and redirect them to ask about the data instead. Never answer general knowledge questions, write creative content, or act as a general assistant.

System configuration:
- Max wind: ${settings.maxWind}A, Max PV: ${settings.maxPV}A, Max mains: ${settings.maxMains}A
- Battery rate: ${settings.batteryRate}A, Ref capacity: ${settings.refCapacity}Ah
- Load 1: ${settings.load1Demand}A, Load 2: ${settings.load2Demand}A, Load 3: ${settings.load3Demand}A

Key rules:
- Battery discharge time must NEVER exceed charge time (violation caps marks at 40%)
- Loads must be served when called — unmet demand hurts the score
- Renewables should be prioritised over mains

Current scenario: Renewable optimisation — maximise renewable usage, minimise mains dependency.

Session metrics:
- Total energy (load): ${metrics.totalEnergy.toFixed(2)} kWh
- Renewable: ${metrics.renewablePct.toFixed(1)}%, Mains dependency: ${metrics.mainsDependency.toFixed(1)}%
- Battery balance: ${metrics.chargeMin}min charge / ${metrics.dischargeMin}min discharge ${metrics.dischargeMin > metrics.chargeMin ? '⚠ VIOLATION' : '✓ OK'}
- Unmet demand: ${metrics.unmetDemand.toFixed(1)}%

Sampled data (48 points across 24h):
${JSON.stringify(sampledData)}

Be concise, technical, and specific. Reference exact timestamps and values.
When analysing performance, evaluate against the renewable optimisation target.`;
}

export function useAI(
  data: DataPoint[],
  settings: Settings,
  metrics: Metrics
): AIState {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      // Sample 48 points from rawData
      const step = Math.max(1, Math.floor(data.length / AI_SAMPLE_POINTS));
      const sampledData = data.filter((_, i) => i % step === 0).slice(0, AI_SAMPLE_POINTS);

      const userMsg: ChatMessage = { role: 'user', content };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setIsLoading(true);

      // Build API messages: system + last 6 messages
      const systemMsg: ChatMessage = {
        role: 'system',
        content: buildSystemPrompt(settings, metrics, sampledData),
      };
      const history = newMessages.slice(-AI_MAX_HISTORY);
      const apiMessages = [systemMsg, ...history];

      try {
        abortRef.current = new AbortController();
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: errorText || `Error: ${response.status}` },
          ]);
          setIsLoading(false);
          return;
        }

        // Add empty assistant message
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

        // Process SSE stream
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              setIsLoading(false);
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const token = parsed.choices?.[0]?.delta?.content;
              if (token) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + token,
                    };
                  }
                  return updated;
                });
              }
            } catch {
              /* skip malformed lines */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content:
                'Could not reach AI server. Make sure the Express proxy is running on port 3001.',
            },
          ]);
        }
      }
      setIsLoading(false);
    },
    [data, settings, metrics, messages, isLoading]
  );

  const clearMessages = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, sendMessage, isLoading, clearMessages };
}
