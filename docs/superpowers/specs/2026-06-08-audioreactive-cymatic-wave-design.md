# Cymatic wave in `audioBars` animation mode

**Date:** 2026-06-08
**Branch:** `feat/add-audioreactive`
**Status:** Approved design

## Objective

Make the petals ripple like a travelling wave (amplitude, crest count, moving phase),
driven by audio energy. The ripple is applied to each ring's **template curve before**
`bend.ts` mirrors and tiles it, so the wave appears identical and coherent on every copy
and axis for free.

Designer constraint: this lives **inside the existing `audioBars` animation mode**, not a
new mode.

Not a physical plate simulation — no fields, no particles. A pure, parametric, lightweight
**vector deformation** of the existing curve.

Conceptually: the existing `morphT` ("breathing") is unchanged and governs *how much* a ring
is excited; the wave governs *how* it moves. In this mode we drive the **wave**; `morphT` is
left untouched. Combining wave + breathing is a future extension, not now.

## Scope (this PR)

**Tasks A–C + dev fallback only.** Real microphone capture (Task D) and UI sliders (Task E)
are deferred to follow-up PRs. The wave is fully testable and visibly animated via a
deterministic dev fallback bar generator; the fallback is a clean drop-in seam for the real
audio source later.

## Architecture

Stack: SvelteKit + TypeScript + paper.js + rune-sync.

- `src/lib/types.ts` — data model (`Ring`, `Path`, `Composition`).
- `src/lib/geometry/bend.ts` — `buildRingPath()`: maps `templatePath` (x → angle, y → radius),
  mirrors, tiles `copies` times. **Not modified** — we work upstream.
- `src/lib/geometry/render-pipeline.ts` — render loop; computes `effectiveRing` by
  interpolating `templatePath ↔ secondaryTemplatePath` via `morphT`. **Wave applied here.**
- `src/lib/geometry/wave.ts` — new pure module.
- `src/lib/state/composition.ts` — state mutators (`setRingMorphT`, etc.).
- `src/lib/state/composition-persistence.svelte.ts` — new: the persisted `composition` rune
  with wave-stripped persistence.
- `src/lib/state/animation.svelte.ts` — registers drivers; holds `defaultAudioBarsConfig`.
- `src/lib/state/animation-drivers/audio-bars-driver.ts` — the `audioBars` driver.
- `src/lib/state/animation-drivers/fallback-bars.ts` — new: deterministic dev bar source.
- `src/lib/state/animation-drivers/types.ts` — `AudioBarsConfig`.

Key fact about `bend.ts`: in `anchorToPolar(x, y)`, template **x → angle** (wobble direction),
**y → radius** (base ↔ tip of petal). So the wave must shift **x**. The `Path.crds` are
absolute coordinates of anchors **and** control points; perturbing every pair with the same
smooth function keeps the beziers coherent.

## Task A — data model

`src/lib/types.ts`:

```ts
export type WaveState = {
  amplitude: number; // 0..1, fraction of template width
  crests: number;    // integer >= 1, number of periods along the petal
  phase: number;     // radians
};
```

`Ring` gains an optional field:

```ts
wave?: WaveState | null; // absent/null → no wave → renders identical to today
```

**Backward compatibility (mandatory):** a ring without `wave` renders exactly as before.

## Task B — geometry (pure function)

New `src/lib/geometry/wave.ts`, same philosophy as `path-morph.ts`:

```ts
export function applyWaveToPath(path: Path, wave: WaveState): Path
```

Logic:

1. If `!path` or `wave.amplitude <= 0` → return an unchanged copy
   (`{ cmds: [...path.cmds], crds: [...path.crds] }`).
2. Walk `path.crds` in pairs (x = even index, y = odd index). Compute minX/maxX/minY/maxY;
   `width = max(maxX - minX, ε)`, `height = max(maxY - minY, ε)`.
3. For each pair:
   - `ny = (y - minY) / height;`
   - `dx = wave.amplitude * width * Math.sin(wave.crests * Math.PI * ny + wave.phase);`
   - `newX = x + dx;` (y unchanged).
4. Return `{ cmds: [...path.cmds], crds: newCrds }` — same length, same commands.

**Insertion in `render-pipeline.ts`**, after the morph interpolation and before
`buildRingPath`:

```ts
// effectiveRing already computed (morph applied)
let tpl = effectiveRing.templatePath;
if (effectiveRing.wave && effectiveRing.wave.amplitude > 0 && tpl) {
  tpl = applyWaveToPath(tpl, effectiveRing.wave);
  effectiveRing = { ...effectiveRing, templatePath: tpl };
}
const ringPath = buildRingPath(effectiveRing, radius, scope);
```

Consequence: the wave lands in the geometry, so a future static SVG export of a frame
reproduces the rippled petal with no extra code (the only render path is via
`render-pipeline`; there is no SVG export today).

## Task C — driver `audioBars`

### `animation-drivers/types.ts`

Extend `AudioBarsConfig` (keep `smoothing` / `minHz` / `maxHz`):

```ts
waveCrests: number;        // default 3
waveAmplitudeGain: number; // default 0.3   (band energy → amplitude)
wavePhaseSpeed: number;    // default 2.2    (rad/sec, travel speed of the wave)
```

### `audio-bars-driver.ts`

**Behavior change (intentional):** today this driver maps bars → `morphT` via its returned
`Record<number, number>`. The new `audioBars` maps bars → **wave** via an injected
side-effect and returns `{}`, leaving `morphT` untouched. The existing
`audio-bars-driver.spec.ts` is rewritten accordingly.

- Add injected dep `applyRingWave: (index: number, wave: WaveState | null) => void`.
- `frame(nowMs)`:
  - `const bars = readBars();`
  - `const phase = (nowMs / 1000) * cfg.wavePhaseSpeed;` (same base for all rings → coherent
    wave; add per-ring offset `phase + i * 0.4` for an organic feel between rings).
  - For each ring `i` in `0..ringCount`:
    `applyRingWave(i, { amplitude: clamp01(bars[i] ?? 0) * cfg.waveAmplitudeGain, crests: cfg.waveCrests, phase: phase + i * 0.4 });`
  - `return {};` (morphT / breathing is a separate concern in this mode).
- `dispose()`: for each ring `applyRingWave(i, null)` → the mark returns to rest when the
  mode stops (mirrors how `stopInternal` zeroes `morphT`). `dispose()` reads the ring count
  at disposal time.

Design note (state it in comments): in `audioBars`, per-band energy drives the corresponding
ring's wave **amplitude**; phase scrolls over time (travelling wave → sense of rotation);
crests are constant from config; `morphT`/breathing stays separate.

### `animation.svelte.ts`

- Extend `defaultAudioBarsConfig` with the three new fields.
- Wire the `audioBars` driver:
  - `applyRingWave: (i, w) => setRingWave(i, w)`
  - `readBars: fallback.readBars` (see Task D-lite below)

`nowMs` passed to `frame` is `logicalElapsedMs` (the runtime's accumulated logical time),
which increases monotonically while playing — correct for a travelling phase.

## Task D-lite — dev fallback source (ships in this PR; no mic)

New `src/lib/state/animation-drivers/fallback-bars.ts`:

```ts
export function createFallbackBars(deps: { getRingCount: () => number }): {
  readBars: () => number[];
};
```

- `readBars()` returns `getRingCount()` values in `0..1`, computed deterministically from
  `performance.now()` and the ring index as a sum of slow sines (e.g.
  `0.5 + 0.5 * (0.6 * sin(t*a + i) + 0.4 * sin(t*b + i*1.7)) ...` normalized into 0..1).
- Stateless (no `start`/`stop` needed); purely time-driven so the wave visibly animates
  without permissions.
- This is the seam for Task D: the real Web Audio source will expose the same
  `readBars(): number[]` shape and replace the fallback wiring.

`animation.svelte.ts` constructs `const fallback = createFallbackBars({ getRingCount: () => composition.rings.length })`
and passes `fallback.readBars` as the driver's `readBars`.

## Task — persistence (`composition`)

**Decision:** `wave` lives **on `Ring`** (so render reads `effectiveRing.wave`, `setRingWave`
mutates `composition.rings`, and a future SVG export gets the ripple for free), but it is
**not persisted** to localStorage.

Constraints to satisfy:

1. Use only genuine `rune-sync` primitives (no invented API). Verified exports:
   `createSyncState` (from `rune-sync`) and `localStorageSync` (a real `StateSynchronizer`
   with `read` / `write` / `subscribe`, from `rune-sync/localstorage`).
2. Keep the localStorage key `'composition'` and the stored shape byte-identical for all
   non-wave fields, so previously saved compositions still load unchanged (today's shape has
   no `wave` key, so a stripped blob is identical).
3. Do **not** `setItem` on every animation frame when only `wave` changed — persist only when
   the non-wave shape actually changes.

Why a custom factory is required: `createSyncState`'s dirty-check is
`deepEqual(snapshot, lastSaved)` over the **full** snapshot (including `wave`), with no hook
to ignore a field. Wrapping `synchronizer.write` to strip `wave` would still leave the gate
firing every frame → `setItem` every frame → violates constraint 3.

**Implementation:** new `src/lib/state/composition-persistence.svelte.ts` (must be `.svelte.ts`
because module-level runes only compile there). A small factory modeled on
`createSyncState`'s lifecycle but gating on a **wave-stripped serialization**, reusing genuine
`localStorageSync` I/O:

```ts
// pseudocode
const KEY = 'composition';
const stripWave = (c: Composition): Composition => ({
  ...c,
  rings: c.rings.map(({ wave: _drop, ...rest }) => rest)
});

export const composition = $state<Composition>(DEFAULT_COMPOSITION);

if (typeof window !== 'undefined') {
  $effect.root(() => {
    let lastSavedStripped: string | undefined;
    let initialized = false;

    untrack(() => {
      const saved = localStorageSync.read<Composition>(KEY);
      if (saved) Object.assign(composition, saved);
      lastSavedStripped = JSON.stringify(stripWave($state.snapshot(composition)));
      initialized = true;
    });

    // cross-tab parity with prior lsSync behavior
    $effect(() => {
      const unsub = localStorageSync.subscribe?.(KEY, (remote) => {
        Object.assign(composition, remote);
        lastSavedStripped = JSON.stringify(stripWave($state.snapshot(composition)));
      });
      return () => unsub?.();
    });

    $effect(() => {
      const stripped = stripWave($state.snapshot(composition));
      const serialized = JSON.stringify(stripped);
      if (!initialized || serialized === lastSavedStripped) return; // wave-only → no write
      untrack(() => {
        localStorageSync.write(KEY, stripped);
        lastSavedStripped = serialized;
      });
    });
  });
  try { onDestroy(() => {/* cleanupRoot */}); } catch { /* global context */ }
}
```

`composition.ts` replaces `export const composition = lsSync('composition', DEFAULT_COMPOSITION)`
with `export { composition } from './composition-persistence.svelte';`. `colorMode` and
`uiState` stay on plain `lsSync` (unchanged). Add the mutator (mirrors `setRingMorphT`):

```ts
export function setRingWave(index: number, wave: WaveState | null) {
  composition.rings = composition.rings.map((ring, i) =>
    i === index ? { ...ring, wave } : ring
  );
}
```

Result: wave-only frames mutate the live `composition.rings` (render sees it) but never touch
localStorage; a reload never restores a rippled logo (no stale ripple); `dispose()` nulling
the wave returns the mark to rest.

## Tests (vitest, `*.spec.ts` beside sources)

- **`wave.spec.ts`** (new):
  - `amplitude: 0` → path unchanged (same `crds` values).
  - Known input → expected x-shift per the `sin` formula (deterministic).
  - `cmds` preserved and `crds` length preserved.
- **`audio-bars-driver.spec.ts`** (rewrite): driver calls `applyRingWave` once per ring with
  `amplitude = clamp01(bar) * waveAmplitudeGain`, `crests` from config, phase derived from
  `nowMs`; `frame()` returns `{}`; `dispose()` calls `applyRingWave(i, null)` for each ring.
- **`render-pipeline` spec**: ring with `wave` → geometry differs from no-wave; ring without
  `wave` → identical output. Existing cases stay green.
- **`fallback-bars.spec.ts`** (new): returns `getRingCount()` values, all in `0..1`.
- **`composition-persistence` spec**: wave-only mutation does not write to localStorage;
  a non-wave change does; stored blob never contains a `wave` key; a previously stored
  (wave-less) composition loads unchanged.
- All existing tests stay green.

## Acceptance criteria

- `bend.ts` untouched; `simple` and `dataSeries` drivers untouched.
- No new dependencies; no physics/particles; pure vector deformation.
- Ring without `wave` → identical render to today. Silence / amplitude 0 → static mark. Mode
  end → `wave` nulled, mark at rest.
- `wave` never persisted to localStorage; key and non-wave stored shape unchanged.
- `lint` and typecheck clean.

## Visual acceptance

In `audioBars` mode with a signal: the petals ripple, amplitude follows per-band energy, the
ripple **travels** (phase) giving a slight rotation, and it is coherent across all
copies/axes. A future SVG export of a frame reproduces the rippled shape.

## Deferred (future PRs)

- **Task D:** real microphone source (`audio-source.ts`) via native Web Audio
  (`getUserMedia` → `AudioContext` → `AnalyserNode`, log/Mel band reduction), replacing the
  fallback wiring. Same `readBars(): number[]` contract.
- **Task E:** UI sliders for `waveCrests` / `waveAmplitudeGain` / `wavePhaseSpeed` in the
  animation panel when mode is `audioBars` (run `svelte-autofixer` per `CLAUDE.md`).
