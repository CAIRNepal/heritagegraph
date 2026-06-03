'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { NODE_TYPE_CONFIG, type GraphNode } from '../heritage-data';
import { ImageAttribution } from './ImageAttribution';
import { NodeGlyph } from '../node-icons';

type SpeechState = 'idle' | 'playing' | 'paused';

function useNarration(text: string) {
  const [state, setState] = useState<SpeechState>('idle');
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  const play = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.0;
    utter.lang = 'en-GB';
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('daniel')) ??
      voices.find((v) => v.lang.startsWith('en-GB')) ??
      null;
    if (preferred) utter.voice = preferred;
    utter.onstart  = () => setState('playing');
    utter.onpause  = () => setState('paused');
    utter.onresume = () => setState('playing');
    utter.onend    = () => setState('idle');
    utter.onerror  = () => setState('idle');
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [text]);

  const pause  = useCallback(() => { window.speechSynthesis?.pause();  setState('paused');  }, []);
  const resume = useCallback(() => { window.speechSynthesis?.resume(); setState('playing'); }, []);
  const stop   = useCallback(() => { window.speechSynthesis?.cancel(); setState('idle');    }, []);

  useEffect(() => {
    window.speechSynthesis?.cancel();
    setState('idle');
  }, [text]);

  return { state, play, pause, resume, stop };
}

interface MediaViewerProps {
  node: GraphNode;
}

export function MediaViewer({ node }: MediaViewerProps) {
  const cfg = NODE_TYPE_CONFIG[node.nodeType];
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const { state: narration, play, pause, resume, stop } = useNarration(node.storyText);

  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [node.id]);

  const imageSrc = !imgError && node.imageUrl ? node.imageUrl : null;

  return (
    <>
      <style>{`
        @keyframes soundWave {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <div className="flex flex-col gap-0">
        {/* Hero */}
        <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${cfg.color}55 0%, #0f172a 60%, ${cfg.glowColor}22 100%)` }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <NodeGlyph nodeType={node.nodeType} size={120} color="#fff" strokeWidth={1.25} className="opacity-10 select-none" />
          </div>

          {imageSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={node.label}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />

          {imageSrc && imgLoaded && node.imageCredits?.[imageSrc] && (
            <div className="absolute bottom-2 right-2 max-w-[70%] text-right rounded bg-black/45 px-1.5 py-0.5">
              <ImageAttribution credit={node.imageCredits[imageSrc]} />
            </div>
          )}

          <div className="absolute bottom-3 left-3">
            <AudioButton
              state={narration}
              color={cfg.color}
              glowColor={cfg.glowColor}
              onPlay={play}
              onPause={pause}
              onResume={resume}
              onStop={stop}
            />
          </div>
        </div>

        {/* Geo strip */}
        {node.lat && node.long && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.08]">
            <span className="text-sm">📍</span>
            <div className="text-xs text-gray-400">
              <span className="text-gray-300 font-medium">{node.label}</span>
              <span className="text-gray-600 ml-2">
                {parseFloat(node.lat).toFixed(4)}°N, {parseFloat(node.long).toFixed(4)}°E
              </span>
            </div>
            <div className="ml-auto">
              <a
                href={`https://www.openstreetmap.org/?mlat=${node.lat}&mlon=${node.long}&zoom=15`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 border border-blue-500/30 bg-blue-900/20 px-2 py-0.5 rounded-full transition-colors"
              >
                Map ↗
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

interface AudioButtonProps {
  state: SpeechState;
  color: string;
  glowColor: string;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function AudioButton({ state, color, glowColor, onPlay, onPause, onResume, onStop }: AudioButtonProps) {
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (!hasSpeech) return null;

  if (state === 'idle') {
    return (
      <button
        onClick={onPlay}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
        style={{ background: `${color}cc`, color: '#fff', boxShadow: `0 0 12px ${color}88` }}
        title="Listen to story narration"
      >
        <span>▶</span>
        <span>Narrate</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={state === 'playing' ? onPause : onResume}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-all hover:scale-105"
        style={{ background: `${color}cc`, color: '#fff' }}
        title={state === 'playing' ? 'Pause' : 'Resume'}
      >
        {state === 'playing' ? '⏸' : '▶'}
      </button>
      <button
        onClick={onStop}
        className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs backdrop-blur-sm transition-all hover:scale-105"
        style={{ background: 'rgba(0,0,0,0.6)', color: glowColor, border: `1px solid ${color}66` }}
        title="Stop"
      >
        ■
      </button>
      {state === 'playing' && (
        <div className="flex items-end gap-0.5 h-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-0.5 rounded-full"
              style={{
                background: glowColor,
                height: '70%',
                animation: `soundWave 0.6s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
