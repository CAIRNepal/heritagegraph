'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import type { Message } from '@/lib/chat/useChatStore';
import { cn } from '@/lib/utils';

function friendlyName(path: string) {
  const cleaned = path.replace(/^\//, '').split('?')[0];
  if (!cleaned) return 'Home';
  return cleaned
    .split('/')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' / ');
}

function ParsedContent({ content }: { content: string }) {
  const router = useRouter();
  const parts = content.split(/\[\[([^\]]+)\]\]/g);

  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <button
              key={i}
              onClick={() =>
                router.push(`/graphview?q=${encodeURIComponent(part)}`)
              }
              className="text-[#8B4E1E] dark:text-[#D4915C] underline underline-offset-2 decoration-[#8B4E1E]/40 dark:decoration-[#D4915C]/40 hover:decoration-[#8B4E1E] dark:hover:decoration-[#D4915C] transition-colors"
            >
              {part}
            </button>
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
            ? 'bg-[#2C2C2A] text-white rounded-br-md'
            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
        )}
      >
        <ParsedContent content={message.content} />
      </div>

      {message.navigationPath && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-md px-2 py-1 w-fit mt-1">
          <ArrowRight size={10} />
          Navigated to {friendlyName(message.navigationPath)}
        </div>
      )}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-1">
        <span className="typing-dot" />
        <span className="typing-dot animation-delay-150" />
        <span className="typing-dot animation-delay-300" />
        <style jsx>{`
          .typing-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #9ca3af;
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
