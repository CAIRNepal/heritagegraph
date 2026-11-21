'use client';

import { createContext, useContext } from 'react';

export type Surface = 'public' | 'dashboard';

export type EntityType =
  | 'Person'
  | 'Monument'
  | 'Festival'
  | 'Deity'
  | 'Guthi'
  | 'Ritual'
  | 'Tradition'
  | 'Location'
  | 'Event'
  | 'HistoricalPeriod'
  | 'Iconography'
  | 'Structure'
  | 'Source';

export interface PageContext {
  surface: Surface;
  currentPath: string;
  entityId?: string;
  entityType?: EntityType;
  entityName?: string;
}

const defaultContext: PageContext = { surface: 'public', currentPath: '/' };
const ChatContext = createContext<PageContext>(defaultContext);

export const useChatContext = () => useContext(ChatContext);

export function ChatContextProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: PageContext;
}) {
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
