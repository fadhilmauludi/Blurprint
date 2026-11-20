/**
 * Background music, synthesised live (D-27): no files, no network, nothing
 * AI-generated. A gentle loop in A minor (Am – F – C – G) with a soft pad, a
 * bass pulse and a plucked arpeggio. The "tense" mood (a guess clock or a
 * drawing timer is running) speeds it up, doubles the arpeggio and adds a
 * hi-hat. Uses the classic look-ahead scheduler: a 25 ms timer queues notes
 * 120 ms ahead on the AudioContext clock, so timing stays tight.
 *
 * Off when the player turns it off (remembered), paused while the tab is
 * hidden, and only ever started from a user gesture.
 */
import { ensureContext } from './audio';

export type Mood = 'calm' | 'tense';

const STORAGE_KEY = 'blurprint:music';
const VOLUME = 0.16;
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const BPM: Record<Mood, number> = { calm: 84, tense: 108 };

/** MIDI note numbers. Chord tones for each bar: root, third, fifth (+ octave). */
const PROGRESSION: readonly (readonly number[])[] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];
const ARP_PATTERN = [0, 1, 2, 3, 2, 1, 0, 2];
const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

const readOn = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
};

let on = readOn();
let playing = false;
let mood: Mood = 'calm';
let bus: GainNode | null = null;
let filter: BiquadFilterNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextTime = 0;
let step = 0; // 16th-note steps
let noise: AudioBuffer | null = null;
const listeners = new Set<(on: boolean) => void>();

const tone = (
  ac: AudioContext,
  out: AudioNode,
  f: number,
  t: number,
  d: number,
  gain: number,
  type: OscillatorType,
  attack = 0.01
) => {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + d);
  osc.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + d + 0.05);
};

const hat = (ac: AudioContext, out: AudioNode, t: number, gain: number) => {
  if (!noise) {
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.05), ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  const hp = ac.createBiquadFilter();
  const env = ac.createGain();
  src.buffer = noise;
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(env).connect(out);
  src.start(t);
  src.stop(t + 0.05);
};

/** Queue one 16th-note step at time t. */
const scheduleStep = (ac: AudioContext, out: AudioNode, s: number, t: number, sixteenth: number) => {
  const bar = Math.floor(s / 16) % PROGRESSION.length;
  const inBar = s % 16;
  const chord = PROGRESSION[bar]!;
  const tense = mood === 'tense';

  // Pad: whole bar, two detuned voices per chord tone, slow attack.
  if (inBar === 0) {
    for (const n of chord) {
      tone(ac, out, hz(n) * 0.997, t, sixteenth * 16, 0.035, 'triangle', 0.35);
      tone(ac, out, hz(n) * 1.003, t, sixteenth * 16, 0.035, 'triangle', 0.35);
    }
  }
  // Bass: root on beats 1 and 3 (every beat when tense).
  if (inBar % (tense ? 4 : 8) === 0) tone(ac, out, hz(chord[0]! - 24), t, sixteenth * 3.5, 0.12, 'sine', 0.01);
  // Arpeggio: 8ths when calm, 16ths when tense.
  if (tense || inBar % 2 === 0) {
    const idx = ARP_PATTERN[(tense ? inBar : inBar / 2) % ARP_PATTERN.length]!;
    const note = idx === 3 ? chord[0]! + 12 : chord[idx]!;
    tone(ac, out, hz(note + 12), t, sixteenth * 1.6, tense ? 0.05 : 0.06, 'sine', 0.005);
  }
  // Hi-hat on off-beats when tense.
  if (tense && inBar % 2 === 1) hat(ac, out, t, 0.05);
};

const tick = () => {
  const ac = ensureContext();
  if (!ac || !bus) return;
  const sixteenth = 60 / BPM[mood] / 4;
  while (nextTime < ac.currentTime + LOOKAHEAD_S) {
    scheduleStep(ac, filter ?? bus, step, nextTime, sixteenth);
    nextTime += sixteenth;
    step = (step + 1) % (16 * PROGRESSION.length);
  }
};

const start = () => {
  if (playing || !on) return;
  const ac = ensureContext();
  if (!ac) return;
  if (ac.state === 'suspended') void ac.resume().catch(() => undefined);
  if (!bus) {
    bus = ac.createGain();
    bus.gain.value = 0.0001;
    filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.connect(bus);
    bus.connect(ac.destination);
  }
  bus.gain.cancelScheduledValues(ac.currentTime);
  bus.gain.setTargetAtTime(VOLUME, ac.currentTime, 0.6);
  nextTime = ac.currentTime + 0.05;
  playing = true;
  timer = setInterval(tick, TICK_MS);
};

const stop = () => {
  if (!playing) return;
  playing = false;
  if (timer !== null) clearInterval(timer);
  timer = null;
  const ac = ensureContext();
  if (ac && bus) bus.gain.setTargetAtTime(0.0001, ac.currentTime, 0.15);
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stop();
    else if (on && bus) start();
  });
}

export const music = {
  /** Call from a user gesture (tap / click). No-op when the player turned music off. */
  start,
  stop,
  isOn: (): boolean => on,
  isPlaying: (): boolean => playing,
  setOn(next: boolean): void {
    on = next;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* session only */
    }
    if (next) start();
    else stop();
    listeners.forEach((l) => l(next));
  },
  setMood(next: Mood): void {
    if (mood === next) return;
    mood = next;
    // Brighter filter when tense.
    const ac = ensureContext();
    if (ac && filter) filter.frequency.setTargetAtTime(next === 'tense' ? 4200 : 2400, ac.currentTime, 0.3);
  },
  subscribe(fn: (on: boolean) => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
