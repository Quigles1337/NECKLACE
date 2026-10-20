/**
 * Application state: a tempo and up to four necklaces.
 * Everything here is pure and clamps whatever it is given, so garbage from a URL or an
 * old link never produces an invalid state.
 */
import { VOICE_IDS } from '../audio/voices.js';

export const PALETTE = ['#f7b733', '#4fd1e5', '#f472b6', '#a3e635'];

export const LIMITS = Object.freeze({ nMin: 3, nMax: 32, tempoMin: 40, tempoMax: 240, maxNecklaces: 4 });

/** What a freshly added necklace looks like, by position. */
export const PRESETS = [
  { n: 8, k: 3, rot: 0, voice: 'wood' }, // tresillo
  { n: 4, k: 4, rot: 0, voice: 'kick' }, // four on the floor
  { n: 12, k: 7, rot: 3, voice: 'bell' }, // Bembé bell
  { n: 16, k: 5, rot: 6, voice: 'hat' }, // bossa nova
];

let seq = 0;
export function newId() {
  return ++seq;
}

export function clampInt(v, lo, hi, fallback) {
  const x = Math.round(Number(v));
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, x));
}

export function clampTempo(t) {
  return clampInt(t, LIMITS.tempoMin, LIMITS.tempoMax, 120);
}

export function clampNecklace(nk) {
  if (!nk || typeof nk !== 'object') nk = {};
  const n = clampInt(nk.n, LIMITS.nMin, LIMITS.nMax, 8);
  const k = clampInt(nk.k, 1, n, Math.min(3, n));
  const r = clampInt(nk.rot, -1e9, 1e9, 0);
  const rot = ((r % n) + n) % n;
  const voice = VOICE_IDS.includes(nk.voice) ? nk.voice : VOICE_IDS[0];
  return { id: nk.id == null ? newId() : nk.id, n, k, rot, voice, mute: Boolean(nk.mute) };
}

export function makeNecklace(index = 0, partial = {}) {
  return clampNecklace({ ...PRESETS[index % PRESETS.length], ...partial });
}

export function colorOf(index) {
  return PALETTE[index % PALETTE.length];
}

/** Coerce anything state-shaped into a valid state (at least one necklace, at most four). */
export function normalize(state) {
  if (!state || typeof state !== 'object') state = {};
  let necklaces = Array.isArray(state.necklaces) ? state.necklaces.slice(0, LIMITS.maxNecklaces).map(clampNecklace) : [];
  if (necklaces.length === 0) necklaces = [makeNecklace(0)];
  return { tempo: clampTempo(state.tempo), necklaces };
}

export function defaultState() {
  return normalize({ tempo: 120, necklaces: [makeNecklace(0), makeNecklace(1)] });
}
