/**
 * Web MIDI output. navigator.requestMIDIAccess() on demand (it may prompt), a list of
 * outputs that follows hot-plugging, and send(events, ctxNow) that turns the pure
 * midiEventsFor() messages into output.send(data, timestamp) calls on the
 * performance.now() clock.
 *
 * Browser APIs are always called as methods on their own objects, never detached.
 */
import { midiTimestamp } from './core/midi.js';

export function midiSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

export function createMidiOut({ onChange } = {}) {
  let access = null;
  let output = null;
  let active = false;
  let wantedId = null;

  function outputs() {
    if (!access) return [];
    return [...access.outputs.values()].map((o) => ({ id: o.id, name: o.name || o.id, current: o === output }));
  }

  function choose() {
    if (!access) return;
    const list = [...access.outputs.values()];
    output = list.find((o) => o.id === wantedId) || (output && list.includes(output) ? output : list[0] || null);
    if (output) wantedId = output.id;
    if (onChange) onChange();
  }

  const api = {
    get active() {
      return active && Boolean(output);
    },
    get enabled() {
      return active;
    },
    get output() {
      return output;
    },
    outputs,
    /** Ask for access (prompts once). Resolves true when MIDI is available. */
    async enable() {
      if (!midiSupported()) return false;
      if (!access) {
        access = await navigator.requestMIDIAccess({ sysex: false });
        access.addEventListener('statechange', () => choose());
      }
      active = true;
      choose();
      return true;
    },
    disable() {
      active = false;
      api.allNotesOff();
      if (onChange) onChange();
    },
    select(id) {
      wantedId = id;
      choose();
    },
    /** Send pure events [{ data, time }] whose times are on the audio clock reading `ctxNow` now. */
    send(events, ctxNow) {
      if (!active || !output) return 0;
      const perfNow = performance.now();
      let n = 0;
      for (const e of events) {
        try {
          output.send(e.data, midiTimestamp(e.time, ctxNow, perfNow));
          n++;
        } catch {
          /* a port that just went away */
        }
      }
      return n;
    },
    allNotesOff() {
      if (!output) return;
      for (let ch = 0; ch < 16; ch++) {
        try {
          output.send([0xb0 | ch, 123, 0]);
        } catch {
          /* ignore */
        }
      }
    },
  };
  return api;
}
