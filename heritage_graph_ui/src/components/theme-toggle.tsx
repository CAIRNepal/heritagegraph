// components/theme-toggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isDark = theme === 'dark';

  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={isDark}
        onChange={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label="Toggle Dark Mode"
      />
      <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors"></div>
      <div
        className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full border border-border shadow-md transform transition-transform
          ${isDark ? 'translate-x-5' : 'translate-x-0'}`}
      />
      <div className="absolute left-1 top-1 flex items-center justify-center w-4 h-4 pointer-events-none">
        {isDark ? (
          <Sun className="w-3 h-3 text-yellow-400" />
        ) : (
          <Moon className="w-3 h-3 text-gray-600" />
        )}
      </div>
    </label>
  );
}
