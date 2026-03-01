import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage } from '../types';
import { Send, Trash2, Sparkles, Copy, Check } from 'lucide-react';

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`ul-${listKey}`} className="list-disc list-inside my-1.5 space-y-0.5">
          {listItems}
        </ul>
      );
      listItems = [];
      listKey++;
    }
  };

  const inlineFormat = (str: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Match **bold**, `code`, or plain text segments
    const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index));
      }
      if (match[2]) {
        // **bold**
        parts.push(<strong key={match.index} className="font-semibold text-text-primary">{match[2]}</strong>);
      } else if (match[3]) {
        // `code`
        parts.push(
          <code key={match.index} className="font-mono text-[13px] bg-bg-surface2 px-1.5 py-0.5 rounded">
            {match[3]}
          </code>
        );
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [str];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ### Heading 3
    if (line.startsWith('### ')) {
      flushList();
      result.push(
        <h4 key={`h3-${i}`} className="text-[14px] font-semibold text-text-primary mt-3 mb-1">
          {inlineFormat(line.slice(4))}
        </h4>
      );
      continue;
    }

    // ## Heading 2
    if (line.startsWith('## ')) {
      flushList();
      result.push(
        <h3 key={`h2-${i}`} className="text-[15px] font-semibold text-text-primary mt-4 mb-1.5">
          {inlineFormat(line.slice(3))}
        </h3>
      );
      continue;
    }

    // # Heading 1
    if (line.startsWith('# ')) {
      flushList();
      result.push(
        <h2 key={`h1-${i}`} className="text-[16px] font-semibold text-text-primary mt-4 mb-1.5">
          {inlineFormat(line.slice(2))}
        </h2>
      );
      continue;
    }

    // - or * list items
    const listMatch = line.match(/^[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(<li key={`li-${i}`}>{inlineFormat(listMatch[1])}</li>);
      continue;
    }

    // Numbered list: 1. item
    const numMatch = line.match(/^\d+\.\s+(.+)/);
    if (numMatch) {
      // Flush unordered list before starting ordered items
      flushList();
      // Collect consecutive numbered items
      const olItems: React.ReactNode[] = [<li key={`oli-${i}`}>{inlineFormat(numMatch[1])}</li>];
      let j = i + 1;
      while (j < lines.length) {
        const nm = lines[j].match(/^\d+\.\s+(.+)/);
        if (!nm) break;
        olItems.push(<li key={`oli-${j}`}>{inlineFormat(nm[1])}</li>);
        j++;
      }
      result.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside my-1.5 space-y-0.5">
          {olItems}
        </ol>
      );
      i = j - 1; // skip processed lines
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      result.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }

    // Plain paragraph
    flushList();
    result.push(
      <p key={`p-${i}`} className="my-0.5">
        {inlineFormat(line)}
      </p>
    );
  }

  flushList();
  return result;
}

interface Props {
  messages: ChatMessage[];
  sendMessage: (content: string) => void;
  isLoading: boolean;
  clearMessages: () => void;
  hasData: boolean;
}

const QUICK_ACTIONS = [
  {
    label: '🔍 Analyze Performance',
    primary: true,
    requiresData: true,
    prompt:
      "Provide a comprehensive assessment of this algorithm's performance. Evaluate renewable usage, mains dependency, battery management, and load servicing. Identify specific timestamps where the algorithm performed well or poorly.",
  },
  {
    label: '📄 Report Summary',
    primary: false,
    requiresData: false,
    prompt:
      'Write a concise technical paragraph summarising this test run, suitable for inclusion in a 5,000-word engineering report. State the scenario, key metrics, notable events, and areas for improvement.',
  },
  {
    label: '⚡ Battery Analysis',
    primary: false,
    requiresData: false,
    prompt:
      'Analyse the battery charge/discharge patterns. Is the discharge-never-exceeds-charge rule satisfied? Were there any suspected rejected charge commands? How could battery cycling be improved?',
  },
];

const SUGGESTED_PROMPTS = [
  'What was peak mains draw and when?',
  'How many times was load 2 not served?',
  'Compare renewable usage day vs night',
  'Was battery cycling efficient?',
  'Where could the algorithm improve?',
];

export default function AIInsights({
  messages,
  sendMessage,
  isLoading,
  clearMessages,
  hasData,
}: Props) {
  const [input, setInput] = useState('');
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [viewState, setViewState] = useState<'empty' | 'fade-out-empty' | 'active' | 'fade-out-active'>(
    messages.length === 0 ? 'empty' : 'active'
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const prevMsgLenRef = useRef(messages.length);

  // Textarea auto-grow
  const adjustTextareaHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.overflow = 'hidden';
    ta.style.height = 'auto';
    const lineHeight = 20;
    const minH = lineHeight * 2;
    const maxH = lineHeight * 6;
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minH), maxH)}px`;
    if (ta.scrollHeight > maxH) {
      ta.style.overflow = 'auto';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [input, adjustTextareaHeight]);

  // Smart auto-scroll
  const handleChatScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isUserScrolledUpRef.current = distFromBottom > 100;
  }, []);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el || isUserScrolledUpRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Transition between empty and active states
  useEffect(() => {
    const hasMessages = messages.length > 0;
    prevMsgLenRef.current = messages.length;

    if (hasMessages && viewState === 'empty') {
      setViewState('fade-out-empty');
      const timer = setTimeout(() => setViewState('active'), 150);
      return () => clearTimeout(timer);
    }
    if (!hasMessages && viewState === 'active') {
      setViewState('fade-out-active');
      const timer = setTimeout(() => setViewState('empty'), 150);
      return () => clearTimeout(timer);
    }
    // If messages exist on mount but state is wrong, fix it
    if (hasMessages && (viewState === 'fade-out-active')) {
      setViewState('active');
    }
    if (!hasMessages && (viewState === 'fade-out-empty')) {
      setViewState('empty');
    }
  }, [messages.length, viewState]);

  // Copy handler
  const handleCopy = useCallback((text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    const timer = setTimeout(() => setCopiedIdx(null), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    });
    sendMessage(text);
  };

  const handleQuickAction = (prompt: string) => {
    setInput('');
    sendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmptyView = viewState === 'empty' || viewState === 'fade-out-empty';
  const isActiveView = viewState === 'active' || viewState === 'fade-out-active';

  // Shared textarea + send button container
  const renderInputContainer = (placeholder: string) => (
    <div
      className="bg-bg-surface1 border border-border-default rounded-2xl p-4 pb-3 w-full transition-shadow focus-within:[box-shadow:0_0_0_2px_rgba(160,200,255,0.4)]"
    >
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        rows={2}
        className="w-full bg-transparent border-none outline-none text-[14px] text-text-primary placeholder-text-tertiary resize-none disabled:opacity-50"
        style={{ overflow: 'hidden' }}
      />
      <div className="flex justify-end mt-1">
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white disabled:opacity-30 hover:opacity-90 transition-opacity"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );

  // Quick action pills
  const renderQuickActionPills = (centered: boolean) => (
    <div className={`flex flex-wrap gap-2.5 ${centered ? 'justify-center' : ''}`}>
      {QUICK_ACTIONS.map((action) => {
        const disabled = action.requiresData && !hasData;
        return (
          <button
            key={action.label}
            onClick={() => !disabled && handleQuickAction(action.prompt)}
            disabled={disabled || isLoading}
            title={disabled ? 'Load data first' : undefined}
            className={`px-4 py-2 text-[13px] rounded-full border bg-transparent transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-text-secondary hover:bg-bg-surface1 hover:border-text-muted ${
              action.primary ? 'border-accent' : 'border-border-default'
            }`}
          >
            {action.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] relative">
      {/* Empty State */}
      {isEmptyView && (
        <div
          className="flex-1 flex items-center justify-center transition-opacity duration-150"
          style={{ opacity: viewState === 'fade-out-empty' ? 0 : 1 }}
        >
          <div className="w-full max-w-2xl px-4">
            {/* Greeting */}
            <div className="flex items-center gap-3 justify-center mb-6">
              <Sparkles size={28} className="text-accent" />
              <h2 className="text-[28px] font-semibold text-text-primary">
                D5 Algorithm Advisor
              </h2>
            </div>

            {/* Input container */}
            <div className="mb-5">
              {renderInputContainer('Ask about the data...')}
            </div>

            {/* Quick action pills */}
            <div className="mb-3">
              {renderQuickActionPills(true)}
            </div>

            {/* Suggested prompt pills */}
            <div className="flex flex-wrap justify-center gap-2.5">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="px-4 py-2 text-[13px] rounded-full border border-border-default bg-transparent text-text-secondary hover:bg-bg-surface1 hover:border-text-muted transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active State */}
      {isActiveView && (
        <div
          className="flex-1 flex flex-col min-h-0 transition-all duration-200"
          style={{
            opacity: viewState === 'fade-out-active' ? 0 : 1,
            transform: viewState === 'fade-out-active' ? 'translateY(8px)' : 'translateY(0)',
          }}
        >
          {/* Zone 1 — Quick actions (top, sticky) */}
          <div className="flex items-center py-3 border-b border-border-subtle">
            {renderQuickActionPills(false)}
            <button
              onClick={clearMessages}
              className="ml-auto px-2 py-1 text-text-tertiary hover:text-text-secondary transition-colors"
              title="Clear chat"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Zone 2 — Messages (middle, scrollable) */}
          <div
            ref={chatContainerRef}
            onScroll={handleChatScroll}
            className="flex-1 overflow-y-auto py-5"
          >
            <div className="max-w-3xl mx-auto space-y-5 px-4">
              {messages.map((msg, i) => {
                if (msg.role === 'user') {
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="bg-bg-surface3 rounded-[20px] px-4 py-2.5 max-w-[80%] text-[14px] text-text-primary">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                if (msg.role === 'system') {
                  return (
                    <div key={i} className="text-[13px] text-error">
                      {msg.content}
                    </div>
                  );
                }
                // assistant
                const isStreaming = isLoading && i === messages.length - 1;
                return (
                  <div key={i}>
                    <div className="text-[14px] text-text-primary">
                      {renderMarkdown(msg.content)}
                      {isStreaming && (
                        <span
                          className="text-accent"
                          style={{ animation: 'blink 1s step-end infinite' }}
                        >
                          |
                        </span>
                      )}
                    </div>
                    {!isStreaming && msg.content && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => handleCopy(msg.content, i)}
                          className="text-text-tertiary hover:text-text-primary transition-colors"
                          title="Copy"
                        >
                          {copiedIdx === i ? (
                            <Check size={16} />
                          ) : (
                            <Copy size={16} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zone 3 — Input (bottom, sticky) */}
          <div className="pt-3 pb-2">
            <div className="max-w-3xl mx-auto px-4">
              {renderInputContainer('Reply...')}
              <p className="text-[11px] text-text-muted text-center mt-2">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
