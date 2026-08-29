'use client';

import { useEffect, useState, type RefObject } from 'react';

export function useFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement;
      setFullscreen(el !== null && el === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange as EventListener);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange as EventListener);
    };
  }, [containerRef]);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        const rq = (
          el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> }
        ).webkitRequestFullscreen;
        await el.requestFullscreen?.().catch(async () => {
          if (rq) await rq();
        });
      } else {
        await document.exitFullscreen?.();
      }
    } catch {
      /* user gesture denied or unsupported */
    }
  };

  return { isFullscreen, toggleFullscreen };
}
