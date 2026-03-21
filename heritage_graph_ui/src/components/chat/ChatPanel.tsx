'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Send } from 'lucide-react';
import { useChatStore } from '@/lib/chat/useChatStore';
import { useChatContext } from '@/providers/ChatContextProvider';
import { getDummyResponse } from '@/lib/chat/dummyResponses';
import { ChatMessage, TypingIndicator } from './ChatMessage';
import { SuggestionChips } from './SuggestionChips';

export function ChatPanel() {
  const router = useRouter();
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
        router.push(nav);
      }

      addMessage({
        role: 'assistant',
        content: response,
        navigationPath: nav,
      });

      setLoading(false);
    },
    [isLoading, addMessage, setLoading, router]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const showChips = messages.length === 0;

  return (
    <div className="w-[320px] max-h-[480px] flex flex-col bg-white dark:bg-zinc-900 border border-[#E2DED6] dark:border-zinc-700 rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-[#E2DED6] dark:border-zinc-700 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-[#2C2C2A] dark:bg-zinc-700 flex items-center justify-center text-[10px]">
            🕯️
          </div>
          <div>
            <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
              HeritageGraph Assistant
            </p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
              Ask or navigate
            </p>
          </div>
        </div>
        <button
          onClick={close}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X size={14} className="text-zinc-500" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-2xl">🕯️</div>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 max-w-[240px] mx-auto leading-relaxed">
              Ask about Nepali cultural heritage, or navigate HeritageGraph.
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

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-2.5 border-t border-[#E2DED6] dark:border-zinc-700 shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask something…"
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none max-h-20 leading-relaxed"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isLoading}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#2C2C2A] dark:bg-zinc-700 text-white disabled:opacity-30 hover:bg-[#3C3C3A] dark:hover:bg-zinc-600 transition-colors shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
