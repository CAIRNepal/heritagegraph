'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { GraphNode } from '../heritage-data';
import { buildBeats, clampBeatIndex, type Beat } from './storyBeats';

/**
 * Story playback for every museum surface that reads a record aloud or advances
 * through its beats.
 *
 * A record must sound and pace the same whichever view the visitor is in, so
 * speech rate, voice, and beat duration are settled here and nowhere else.
 */

export type NarrationState = 'idle' | 'playing' | 'paused';

export interface Narration {
  state: NarrationState;
  playing: boolean;
  /** False until the client confirms Web Speech support — never true on the server. */
  supported: boolean;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

/** Slightly under natural pace: heritage names need room to be heard. */
const SPEECH_RATE = 0.9;

/** Read `text` aloud through the Web Speech API, stopping when it changes. */
export function useNarration(text: string): Narration {
  const [state, setState] = useState<NarrationState>('idle');
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  const play = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = SPEECH_RATE;
    utterance.pitch = 1;
    utterance.lang = 'en-GB';
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith('en') && v.name.toLowerCase().includes('daniel')) ??
      voices.find((v) => v.lang.startsWith('en-GB')) ??
      null;
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setState('playing');
    utterance.onpause = () => setState('paused');
    utterance.onresume = () => setState('playing');
    utterance.onend = () => setState('idle');
    utterance.onerror = () => setState('idle');
    window.speechSynthesis.speak(utterance);
    setState('playing');
  }, [text]);

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setState('playing');
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState('idle');
  }, []);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      setState('idle');
    };
  }, [text]);

  return { state, playing: state === 'playing', supported, play, pause, resume, stop };
}

export interface BeatPlayer {
  beats: Beat[];
  index: number;
  beat: Beat | undefined;
  progress: number;
  paused: boolean;
  setPaused: (paused: boolean) => void;
  go: (index: number) => void;
}

const BEAT_MS = 10_000;

export function useBeatPlayer(
  node: GraphNode,
  reducedMotion: boolean,
  beatMs: number = BEAT_MS,
  /**
   * True when the node's prose fields carry no recorded source — the demo
   * corpus. Threaded through rather than inferred inside `buildBeats`, because
   * a live reviewed node's `description` is the API's `rdfs:comment` and is
   * sourced: the same field name means different things per data source.
   */
  unsourcedProse = true,
): BeatPlayer {
  const beats = useMemo(() => buildBeats(node, unsourcedProse), [node, unsourcedProse]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const pausedProgressRef = useRef(0);

  useEffect(() => {
    setIndex(0);
    setProgress(0);
    pausedProgressRef.current = 0;
  }, [node.id, beats.length]);

  useEffect(() => {
    if (reducedMotion || paused) {
      pausedProgressRef.current = progress;
      return;
    }
    const startProgress = pausedProgressRef.current || progress;
    startRef.current = performance.now() - (startProgress / 100) * beatMs;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - startRef.current) / beatMs) * 100);
      setProgress(p);
      if (p >= 100 && beats.length > 0) {
        setIndex((i) => clampBeatIndex(i + 1, beats.length));
        setProgress(0);
        pausedProgressRef.current = 0;
        startRef.current = performance.now();
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, index, beats.length, reducedMotion, beatMs]);

  const go = useCallback((next: number) => {
    setIndex(next);
    setProgress(0);
    pausedProgressRef.current = 0;
    startRef.current = performance.now();
  }, []);

  const safeIndex = clampBeatIndex(index, beats.length);

  return {
    beats,
    index: safeIndex,
    beat: beats[safeIndex],
    progress,
    paused,
    setPaused,
    go,
  };
}
