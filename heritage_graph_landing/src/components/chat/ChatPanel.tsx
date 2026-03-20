'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { X, Send } from 'lucide-react';
import { useChatStore } from '@/lib/chat/useChatStore';
import { useChatContext } from '@/providers/ChatContextProvider';
import { getDummyResponse } from '@/lib/chat/dummyResponses';
import { ChatMessage, TypingIndicator } from './ChatMessage';
import { SuggestionChips } from './SuggestionChips';
import { appPath } from '@/lib/config';

export function ChatPanel() {
  const { surface, entityType } = useChatContext();
  const { messages, isLoading, close, addMessage, setLoading } =
    useChatStore();

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, isLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      addMessage({ role: 'user', content: text });
      setInput('');
      setLoading(true);

      await new Promise((r) => setTimeout(r, 700 + Math.random() * 400));

      const { response, nav } = getDummyResponse(text);

      if (nav) {
        const target = appPath(nav);
        window.location.assign(target);
      }

      addMessage({
        role: 'assistant',
        content: response,
        navigationPath: nav,
      });

      setLoading(false);
    },
    [isLoading, addMessage, setLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const showChips = messages.length === 0;

  return (
    <div className="w-[320px] max-h-[480px] flex flex-col bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] text-primary-foreground">
            🕯️
          </div>
          <div>
            <p className="text-[12px] font-semibold text-foreground leading-tight">
              HeritageGraph Assistant
            </p>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Ask or navigate
            </p>
          </div>
        </div>
        <button
          onClick={close}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
        >
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-2xl">🕯️</div>
            <p className="text-[12px] text-muted-foreground max-w-[240px] mx-auto leading-relaxed">
              Ask about Nepali cultural heritage, or jump into the main app.
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator />}

        {showChips && (
          <div className="pt-2">
            <SuggestionChips
              entityType={entityType}
              surface={surface}
              onSelect={handleSend}
            />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 px-3 py-2.5 border-t border-border shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none max-h-20 leading-relaxed"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isLoading}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-30 hover:opacity-90 transition-opacity shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
