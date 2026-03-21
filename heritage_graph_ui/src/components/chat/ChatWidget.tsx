'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { useChatStore } from '@/lib/chat/useChatStore';
import { useChatContext } from '@/providers/ChatContextProvider';
import { ChatPanel } from './ChatPanel';

export function ChatWidget() {
  const { surface, currentPath } = useChatContext();
  const { isOpen, toggle } = useChatStore();
  const [launcherVisible, setLauncherVisible] = useState(false);

  // Landing page: show launcher after scroll > 300px
  // Everywhere else: show immediately
  useEffect(() => {
    if (surface === 'public' && currentPath === '/') {
      const handler = () => {
        setLauncherVisible(window.scrollY > 300);
      };
      handler();
      window.addEventListener('scroll', handler, { passive: true });
      return () => window.removeEventListener('scroll', handler);
    }
    setLauncherVisible(true);
  }, [surface, currentPath]);

  // Cmd+K / Ctrl+K on dashboard
  useEffect(() => {
    if (surface !== 'dashboard') return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [surface, toggle]);

  return (
    <>
      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 10 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            style={{
              position: 'fixed',
              bottom: '88px',
              right: '24px',
              zIndex: 50,
            }}
          >
            <ChatPanel />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher */}
      <AnimatePresence>
        {launcherVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={toggle}
            className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-[#2C2C2A] dark:bg-zinc-700 text-white flex items-center justify-center shadow-lg"
            aria-label="Open chat"
          >
            <MessageCircle size={20} />
            {/* Green dot */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#4CAF82] rounded-full border-2 border-[#2C2C2A] dark:border-zinc-700" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
