'use client';

import { usePathname } from 'next/navigation';
import { ChatContextProvider, type Surface } from './ChatContextProvider';
import { ChatWidget } from '@/components/chat/ChatWidget';

interface ChatContextWrapperProps {
  children: React.ReactNode;
  surface: Surface;
}

export function ChatContextWrapper({
  children,
  surface,
}: ChatContextWrapperProps) {
  const pathname = usePathname();

  return (
    <ChatContextProvider value={{ surface, currentPath: pathname }}>
      {children}
      <ChatWidget />
    </ChatContextProvider>
  );
}
