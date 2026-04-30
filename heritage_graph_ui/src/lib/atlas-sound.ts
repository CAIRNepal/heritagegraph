const STORAGE_KEY = 'atlas:muted';

export type SoundEvent =
  | 'hover'
  | 'click'
  | 'select'
  | 'whoosh'
  | 'uiOpen'
  | 'uiClose'
  | 'error'
  | 'tick';

const MASTER_GAIN = 0.08;
const TICK_MIN_MS = 60;
let lastTick = 0;
let lastHover = 0;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function loadMutedPreference(): boolean {
  if (typeof window === 'undefined') return prefersReducedMotion();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return prefersReducedMotion();
    return raw === '1';
  } catch {
    return prefersReducedMotion();
  }
}

let muted = loadMutedPreference();

function persistMutedPreference() {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx || ctx.state === 'closed') {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    muted = loadMutedPreference();
    master.gain.value = muted ? 0 : MASTER_GAIN;
    master.connect(ctx.destination);
  }
  return ctx;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function oscillatorTone(
  c: AudioContext,
  freq: number,
  type: OscillatorType,
  duration: number,
  gainPeak: number,
  frequencyEnd?: number,
): void {
  if (!master) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (frequencyEnd !== undefined && frequencyEnd !== freq) {
    osc.frequency.linearRampToValueAtTime(frequencyEnd, c.currentTime + duration);
  }
  g.gain.setValueAtTime(gainPeak, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(g);
  g.connect(master);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + duration + 0.02);
}

function triadSelect(c: AudioContext): void {
  if (!master) return;
  oscillatorTone(c, 440 * 1.005, 'sine', 0.25, 0.035);
  oscillatorTone(c, 523.25 * 0.995, 'sine', 0.25, 0.035);
  oscillatorTone(c, 659.25, 'sine', 0.25, 0.035);
}

function lowPassSq(c: AudioContext): void {
  if (!master) return;
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const g = c.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(220, c.currentTime);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1200, c.currentTime);
  g.gain.setValueAtTime(0.12, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
  osc.connect(filter);
  filter.connect(g);
  g.connect(master);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + 0.09);
}

function noiseWhoosh(c: AudioContext): void {
  if (!master) return;
  const len = Math.floor(c.sampleRate * 0.22);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(300, c.currentTime);
  bp.frequency.exponentialRampToValueAtTime(1800, c.currentTime + 0.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.22);
  src.connect(bp);
  bp.connect(g);
  g.connect(master);
  src.start(c.currentTime);
  src.stop(c.currentTime + 0.23);
}

function descendingError(c: AudioContext): void {
  oscillatorTone(c, 400, 'triangle', 0.12, 0.08, 300);
}

export const atlasSound = {
  init(): void {
    muted = loadMutedPreference();
    const c = ensureContext();
    if (c && master) {
      master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, c.currentTime, 0.02);
    }
    void c?.resume();
  },

  setMuted(m: boolean): void {
    muted = m;
    persistMutedPreference();
    const c = ensureContext();
    if (c && master) {
      master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_GAIN, c.currentTime + 0.06);
    }
  },

  isMuted(): boolean {
    muted = loadMutedPreference();
    return muted;
  },

  /** Call after hydrating store from localStorage */
  refreshMuteFromStorage(): void {
    muted = loadMutedPreference();
    const c = ensureContext();
    if (c && master) {
      master.gain.setValueAtTime(muted ? 0 : MASTER_GAIN, c.currentTime);
    }
  },

  toggleMuted(): boolean {
    this.setMuted(!this.isMuted());
    return muted;
  },

  play(e: SoundEvent): void {
    if (muted) return;
    const c = ensureContext();
    if (!c || !master) return;
    void c.resume();

    switch (e) {
      case 'hover': {
        const t = now();
        if (t - lastHover < TICK_MIN_MS) return;
        lastHover = t;
        oscillatorTone(c, 880, 'sine', 0.04, 0.04);
        break;
      }
      case 'click':
        lowPassSq(c);
        break;
      case 'select':
        triadSelect(c);
        break;
      case 'whoosh':
        noiseWhoosh(c);
        break;
      case 'uiOpen':
        oscillatorTone(c, 440, 'sine', 0.18, 0.06, 880);
        break;
      case 'uiClose':
        oscillatorTone(c, 880, 'sine', 0.18, 0.06, 440);
        break;
      case 'error':
        descendingError(c);
        break;
      case 'tick': {
        const t = now();
        if (t - lastTick < TICK_MIN_MS) return;
        lastTick = t;
        oscillatorTone(c, 1200, 'sine', 0.025, 0.03);
        break;
      }
      default:
        break;
    }
  },
};
