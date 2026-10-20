# NECKLACE

**Play it: [quigles1337.github.io/NECKLACE](https://quigles1337.github.io/NECKLACE/)**

Euclidean rhythms drawn the way Godfried Toussaint drew them: *n* points on a circle,
the *k* onsets joined into a polygon, a playhead sweeping once per bar. Layer up to four
necklaces with different step counts and they play as a polyrhythm. Every one of the 27
rhythms named in the paper is one click away, in the orientation the paper says it is
usually played. The whole scene lives in the URL, so a link is a save file.

Zero dependencies, no build step, vanilla ES modules, Web Audio synthesis (no samples).

![Four necklaces playing: tresillo, four-on-the-floor, the Bembé bell and a bossa nova](docs/screenshot.jpg)

## Controls

| Where | What |
| --- | --- |
| **Play / Stop** or <kbd>space</kbd> or click the ring | start and stop the transport (audio starts on the first gesture) |
| **Tempo** | 40–240 bpm; one bar is four beats and every necklace shares that bar |
| **+ Necklace** | layer another ring (up to four), each with its own colour and stereo position |
| **Load a rhythm from the paper…** | per necklace: all 27 Euclidean rhythms from Toussaint (2005) plus the named rotations the paper identifies, grouped by step count |
| **steps / onsets / rotate** | `n` (3–32), `k` (1–`n`), and the step the pattern starts on |
| **voice** | tick, wood, bell, kick, snare, hat, all synthesized from oscillators and noise |
| **M** / **×** | mute / remove a necklace |
| **Share link** | copies the URL; it encodes tempo and every necklace |

Under each card: the box notation (`x` onset, `.` rest), the inter-onset interval vector,
and the paper's name for what is on screen (`Tresillo`, `Cinquillo`, `Aksak`, `Bembé bell`,
…). Rotate a named rhythm away from the paper's orientation and it reads `… necklace`,
Toussaint's word for the rotation class.

## How it works

**Bjorklund's algorithm.** `E(k,n)` distributes `k` onsets over `n` steps as evenly as
possible. Start with `k` sequences `[1]` and `n-k` sequences `[0]`; append one remainder
sequence to each leading sequence; whatever is left over is the new remainder; stop when
the remainder is a single sequence. The steps are exactly those of Euclid's gcd algorithm,
which is where the name comes from. One detail matters: the distribution step must run at
least once, otherwise `E(3,4)` comes out `xxx.` instead of the paper's `x.xx`.
`src/core/euclid.js`, tested against all 27 patterns the paper prints.

**Necklaces.** Toussaint draws a rhythm as a polygon inscribed in a circle: step 0 at
twelve o'clock, time running clockwise, the onsets joined up. Two rhythms that are
rotations of each other are the same *necklace*. `src/core/geometry.js` places the points;
`src/render.js` draws rings, polygons, flashes and the playhead on a canvas.

**Polyrhythm.** Every necklace divides the *same* bar into its own `n` steps, so a
3-step ring against a 4-step ring is 3:4, `E(5,16)` against `E(7,12)` is 16 against 12,
and so on. One playhead serves all rings because they share the bar.

**Scheduling.** The classic two clocks: a `setInterval` loop wakes every 25 ms and
schedules every hit that falls inside a 120 ms look-ahead window on the `AudioContext`
clock (1.5 s while the tab is hidden). The pure `Sequencer` in `src/core/schedule.js`
walks bars in order; tempo changes land on the next bar boundary so rings never drift
apart, necklaces added mid-bar join at their next step, and a stalled tab skips rather
than bursts. Onsets light up when their audio time arrives, corrected by output latency.

**Voices.** Six percussive voices from oscillators and filtered noise
(`src/audio/voices.js`): tick, woodblock, an FM bell, a swept kick, a snare, and a
six-oscillator hat. Every hit cleans up its own nodes.

**Sharing.** `src/core/state.js` encodes the state as a short readable hash,
`#t=120&r=3.8.0.wood&r=4.4.0.kick` (`r` = `k.n.rot.voice[.m]`), and decodes it with
clamping, so any link, even a hand-edited one, yields a valid scene.

## Share a link

Everything on screen is in the address bar. Press **Share link** (or copy the URL) and
whoever opens it sees and hears the same necklaces at the same tempo. A few to start:

- [Tresillo over a kick](https://quigles1337.github.io/NECKLACE/#t=120&r=3.8.0.wood&r=4.4.0.kick)
- [Bossa nova, Bembé bell, tresillo, kick](https://quigles1337.github.io/NECKLACE/#t=112&r=3.8.0.wood&r=4.4.0.kick&r=7.12.3.bell&r=5.16.6.hat)
- [Aksak against three](https://quigles1337.github.io/NECKLACE/#t=132&r=4.9.0.wood&r=2.3.0.kick)
- [The two Aka Pygmy necklaces](https://quigles1337.github.io/NECKLACE/#t=100&r=11.24.14.tick&r=13.24.5.bell)

## Embed it

Add `?embed=1` and the page shows only the stage, a tiny play button and a corner
**NECKLACE** link back to the full app. Put any scene in the hash:

```html
<iframe src="https://quigles1337.github.io/NECKLACE/?embed=1#t=120&r=3.8.0.wood&r=4.4.0.kick"
        width="480" height="480" title="NECKLACE" loading="lazy" allow="autoplay"
        style="border:0;border-radius:12px;background:#0a0c12"></iframe>
```

Browsers block sound until the visitor interacts with the page, so an embed never
plays by itself: the first click on the play button (or the ring) starts the audio.
`embed=1` also works inside the hash (`#t=120&r=3.8.0.wood&embed=1`) for places that
strip query strings.

## Develop

```sh
node --test              # pure logic: Bjorklund, the paper's table, geometry, scheduling, state
node scripts/serve.mjs   # http://127.0.0.1:8137/
```

Node 22 or later for the tests; the page itself needs only a browser with Web Audio.

## The paper

Godfried Toussaint, *The Euclidean Algorithm Generates Traditional Musical Rhythms*,
Proceedings of BRIDGES: Mathematical Connections in Art, Music and Science, Banff, 2005.
[PDF](http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf)

The rhythm names, origins and "usually started on the *n*th onset" notes in
`src/core/rhythms.js` are transcribed from section 4 of the paper.

## License

MIT, Copyright (c) 2026 Quigles1337.
