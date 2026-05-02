'use client';

import { IconMessage, IconSend, IconX } from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { postAssistantChat, type ApiChatMessage, type SourceAttribution } from '@/lib/chat/assistantClient';
import { getApiErrorMessage } from '@/lib/api-client';

import { useAtlasStore } from '../hooks/use-atlas-store';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceAttribution[];
  isError?: boolean;
}

let _msgSeq = 0;
function nextMsgId() {
  _msgSeq += 1;
  return `atlas-chat-${Date.now()}-${_msgSeq}`;
}

interface AiReasoningViewProps {
  compact?: boolean;
}

export function AiReasoningView({ compact = false }: AiReasoningViewProps) {
  const t = useTranslations('Atlas');
  const entities = useAtlasStore((s) => s.entities);
  const selectEntity = useAtlasStore((s) => s.selectEntity);
  const focusView = useAtlasStore((s) => s.focusView);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const chips = [t('aiChipGuthiStupa'), t('aiChipConflicts'), t('aiChipKumari')];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (viewportRef.current) {
        viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
      }
    }, 60);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: ChatMessage = { id: nextMsgId(), role: 'user', content: trimmed };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);
      scrollToBottom();

      const history: ApiChatMessage[] = [...messages, userMsg].map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      try {
        const res = await postAssistantChat({ messages: history, signal: ac.signal });
        const assistantMsg: ChatMessage = {
          id: nextMsgId(),
          role: 'assistant',
          content: res.message.content,
          sources: res.sources,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setLoading(false);
          return;
        }
        const assistantMsg: ChatMessage = {
          id: nextMsgId(),
          role: 'assistant',
          content: getApiErrorMessage(err, t('aiError')),
          isError: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } finally {
        setLoading(false);
        scrollToBottom();
      }
    },
    [loading, messages, scrollToBottom, t],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const handleClear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setLoading(false);
  };

  const isEmpty = messages.length === 0;
  // Compact: show last exchange (2 messages) to keep the tile small
  const displayMessages = compact ? messages.slice(-2) : messages;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2',
        compact ? 'h-full px-1 pb-1' : 'px-2 pb-2 md:pl-16 md:pr-2 md:pt-14',
      )}
    >
      {/* Thread / empty state */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/60 bg-background/70 backdrop-blur-md flex flex-col">
        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-3 py-4 text-center">
            <IconMessage
              className={cn('text-muted-foreground/40', compact ? 'h-5 w-5' : 'h-7 w-7')}
              aria-hidden
            />
            {!compact && (
              <p className="max-w-[24ch] text-[11px] leading-snug text-muted-foreground">
                {t('aiEmptyState')}
              </p>
            )}
            <div className={cn('flex w-full flex-col gap-1', compact ? 'mt-0' : 'mt-1')}>
              {chips.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-full rounded-lg border border-border/50 bg-muted/30 text-left transition-colors hover:bg-muted/50 hover:text-foreground',
                    compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]',
                    'text-muted-foreground',
                  )}
                  onClick={() => void sendMessage(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            ref={viewportRef}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className={cn('flex flex-col gap-2', compact ? 'p-2' : 'p-3')}>
              {displayMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex flex-col gap-1',
                    msg.role === 'user' ? 'items-end' : 'items-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[90%] rounded-xl px-3 py-2 leading-snug',
                      compact ? 'text-[11px]' : 'text-sm',
                      msg.role === 'user'
                        ? 'border border-primary/20 bg-primary/10 text-foreground'
                        : msg.isError
                          ? 'border border-destructive/20 bg-destructive/8 text-destructive'
                          : 'border border-border/50 bg-muted/40 text-foreground',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex max-w-[90%] flex-wrap gap-1 pl-1">
                      {msg.sources.map((src: SourceAttribution) => {
                        const entity = entities.find((e) => e.id === src.id);
                        return (
                          <button
                            key={src.id}
                            type="button"
                            title={src.excerpt ?? src.title}
                            className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                            onClick={() => {
                              if (entity) {
                                selectEntity(src.id);
                                focusView(null);
                              }
                            }}
                          >
                            {src.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-start">
                  <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/40 px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:140ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:280ms]" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div
        className={cn(
          'shrink-0 rounded-xl border border-border/60 bg-background/75 backdrop-blur-md',
          compact ? 'p-1.5' : 'p-2',
        )}
      >
        <div className="flex items-end gap-1">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiPlaceholder')}
            disabled={loading}
            className={cn(
              'flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0',
              compact ? 'max-h-[60px] min-h-[32px]' : 'max-h-[120px] min-h-[44px]',
            )}
          />
          <div className="flex shrink-0 flex-col items-center gap-0.5">
            {!isEmpty && !loading && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 rounded-md opacity-50 hover:opacity-100"
                onClick={handleClear}
                title={t('aiClear')}
              >
                <IconX className="h-3 w-3" />
              </Button>
            )}
            {loading ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md"
                onClick={() => abortRef.current?.abort()}
                title={t('aiCancel')}
              >
                <IconX className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md"
                disabled={!input.trim()}
                onClick={() => void sendMessage(input)}
                title={t('aiSend')}
              >
                <IconSend className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
