/**
 * Transport: the two-clocks pattern. A setInterval loop wakes every 25 ms and asks the
 * pure Sequencer for every step whose time falls within the look-ahead window on the
 * AudioContext clock; the caller schedules sound (and flashes) at those exact times.
 * Hidden tabs throttle timers to ~1 s, so the window widens while the page is hidden.
 */
import { Sequencer } from './core/schedule.js';

const INTERVAL_MS = 25;
const LOOKAHEAD = 0.12;
const LOOKAHEAD_HIDDEN = 1.5;

export function createTransport({ engine, getTempo, getNecklaces, onEvent }) {
  let timer = null;
  let seq = null;

  function lookahead() {
    return typeof document !== 'undefined' && document.hidden ? LOOKAHEAD_HIDDEN : LOOKAHEAD;
  }

  function tick() {
    const e = engine();
    const now = e.ctx.currentTime;
    seq.setTempo(getTempo());
    const events = seq.advance(now, now + lookahead(), getNecklaces());
    for (const ev of events) onEvent(ev);
  }

  const transport = {
    get playing() {
      return timer !== null;
    },
    start() {
      if (timer !== null) return;
      const e = engine();
      seq = new Sequencer({ tempo: getTempo(), startTime: e.ctx.currentTime + 0.08 });
      tick();
      timer = setInterval(() => tick(), INTERVAL_MS);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
    toggle() {
      if (transport.playing) transport.stop();
      else transport.start();
    },
    /** Bar phase 0..1 at audio time t (0 when not started). */
    phase(t) {
      return seq ? seq.phaseAt(t) : 0;
    },
  };
  return transport;
}
