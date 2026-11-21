import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  navigationPath?: string;
  timestamp: Date;
}

interface ChatStore {
  isOpen: boolean;
  messages: Message[];
  isLoading: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => void;
  setLoading: (v: boolean) => void;
  reset: () => void;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadOpen(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem('hg_chat_open') === 'true';
  } catch {
    return false;
  }
}

function persistOpen(v: boolean) {
  try {
    localStorage.setItem('hg_chat_open', String(v));
  } catch {
    /* noop */
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: loadOpen(),
  messages: [],
  isLoading: false,

  toggle: () =>
    set((s) => {
      const next = !s.isOpen;
      persistOpen(next);
      return { isOpen: next };
    }),

  open: () => {
    persistOpen(true);
    set({ isOpen: true });
  },

  close: () => {
    persistOpen(false);
    set({ isOpen: false });
  },

  addMessage: (msg) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { ...msg, id: generateId(), timestamp: new Date() },
      ],
    })),

  setLoading: (v) => set({ isLoading: v }),

  reset: () => {
    persistOpen(false);
    set({ isOpen: false, messages: [], isLoading: false });
  },
}));
