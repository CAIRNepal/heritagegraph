'use client';

import { ArrowRight } from 'lucide-react';
import type { Message } from '@/lib/chat/useChatStore';
import { cn } from '@/lib/utils';
import { appPath } from '@/lib/config';

function friendlyName(path: string) {
  const cleaned = path.replace(/^\//, '').split('?')[0];
  if (!cleaned) return 'App home';
  return cleaned
    .split('/')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' / ');
}

function ParsedContent({ content }: { content: string }) {
  const parts = content.split(/\[\[([^\]]+)\]\]/g);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <a
              key={i}
              href={appPath(`/graphview?q=${encodeURIComponent(part)}`)}
              className="text-primary underline underline-offset-2 decoration-primary/40 hover:decoration-primary transition-colors"
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-muted text-foreground rounded-bl-md'
        )}
      >
        <ParsedContent content={message.content} />
      </div>

      {message.navigationPath && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-md px-2 py-1 w-fit mt-1">
          <ArrowRight size={10} />
          Opened {friendlyName(message.navigationPath)}
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
        <span className="typing-dot" />
        <span className="typing-dot animation-delay-150" />
        <span className="typing-dot animation-delay-300" />
        <style jsx>{`
          .typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--muted-foreground);
            opacity: 0.6;
            animation: typing-bounce 1.2s ease-in-out infinite;
          }
          .animation-delay-150 {
            animation-delay: 0.15s;
          }
          .animation-delay-300 {
            animation-delay: 0.3s;
          }
          @keyframes typing-bounce {
            0%,
            60%,
            100% {
              transform: translateY(0);
            }
            30% {
              transform: translateY(-4px);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
