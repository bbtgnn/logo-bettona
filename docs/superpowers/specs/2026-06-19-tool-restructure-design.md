# Spec — Tool Restructure: Editor / Animate / Paths

**Date:** 2026-06-19
**Branch:** `feat/kaleidoscope` (restructure work continues here unless a new branch is cut)
**Status:** Approved design (brainstorm complete). Next: implementation plan.
**Predecessor:** `docs/reports/2026-06-19-timeline-polish-and-restructure-report.md` §3 (vision).

## Goal

Split the tool into three clearly-navigable sections and consolidate the three
overlapping animation surfaces into one. Designer's stated priority: a mix of
(1) **animation confusion** (controls spread across three places) and
(2) **unclear navigation**. Presets and the Paths archive are explicitly a
**later** phase, not this cycle.

## Background — what exists today

- Single page `/` (`src/routes/+page.svelte`): sidebar + central `PreviewCanvas` +
  `TimelinePanel`. Header links to `/paths` and `/about`.
- Sidebar (`Sidebar.svelte`) sections: Settings, Canvas, Kaleidoscope, Rings,
  Colors, **Animation**.
- **Three animation/keyframe surfaces** (the redundancy to fix):
  1. Sidebar **Animation** section (`AnimationSection.svelte`): exclusive `mode`
     dropdown (`simple` / `audioBars` / `audioZones` / `dataSeries` / none),
     audio source config, `durationSec`, play, progress.
  2. **TimelinePanel** (`TimelinePanel.svelte`, gated behind `kaleidoscope.enabled`):
     kaleidoscope keyframe tracks + graph editor.
  3. **Under-canvas export** (`PreviewCanvas.svelte`): Export SVG / kaleidoscope
     PNG/SVG / Export animation, with its **own** `exportDurationSec` (default 5),
     separate from `animationState.durationSec` (default 3).

### Key finding: audio + keyframes already compose

`animation.svelte.ts:260-261` applies kaleidoscope keyframes **every tick,
independent of `mode`**:

```ts
// Kaleidoscope keyframes ride the same clock regardless of driver mode.
applyKaleidoscopeKeyframes(progress);
```

So audio-reactivity (a driver `mode`) and the kaleidoscope timeline **already run
simultaneously on the same clock**. The problem is purely the UI: the exclusive
`mode` dropdown makes audio *feel* like an either/or choice against the timeline.

Designer's framing: **audio-reactivity is a trait of the mark** (the curves/petals
must keep reacting while the kaleidoscope animates) — it is imprescindibile, not
one animation among many. Decision (see below): the audio *knobs* live in Animate,
but audio becomes an **always-available layer**, not an exclusive mode.

## Decisions (from brainstorm)

| Topic | Decision |
|---|---|
| Navigation | **Separate URL routes**: `/editor`, `/animate`, `/paths`. `/` redirects to `/editor`. Top tabs replace today's header links. About stays reachable (icon/menu). |
| Canvas | **Persistent canvas in the shared shell (layout)** — does not remount across Editor↔Animate, so animation/audio never restart on navigation. Hidden on `/paths`. Approach A (over per-route canvas). |
| Editor contents | Rings, Colors, Kaleidoscope (static look), Canvas (frame/size), Settings. = today's sidebar **minus** the Animation section. |
| Animate contents | Consolidates all three animation surfaces: audio panel + single duration + play + export (left column) and the kaleidoscope timeline/graph (always visible). |
| Audio placement | Audio knobs live **in Animate**, but audio is reframed as an **always-on layer** that coexists with the timeline — not an exclusive `mode`. |
| Duration | **One duration** for both playback and export (unify `durationSec` / `exportDurationSec`). |
| Paths | **Unchanged this cycle** — just reached via the new tab. Becomes shape archive + presets in a later cycle (its own brainstorm). |

## Target structure

```
+----------------------------------------------------+
|  Bettona      [ Editor ] [ Animate ] [ Paths ]  ⚙  |   header tabs; URL changes
+--------------------+-------------------------------+
|  section controls  |          CANVAS               |
|  (swap per route)  |   (persistent, shell-level)   |
+--------------------+-------------------------------+
```

### Editor (`/editor`)
Models the static mark. Sidebar = today's sections **without** Animation:
Settings, Canvas, Kaleidoscope, Rings, Colors. Kaleidoscope params here are the
**base values**; Animate animates them over time (same params, two uses — matches
current code). Canvas shows the mark at rest.

### Animate (`/animate`)
One workspace consolidating the three surfaces:

```
+--------------------+-------------------------------+
|  AUDIO             |          CANVAS               |
|  · source          |     (mark animating)          |
|    (mic/file/demo) +-------------------------------+
|  · per-band gain   |  ▸ Timeline | Graph           |
|  DURATION [ 3.0s ] |  0s ···•···•···· 3s   play    |
|  ▶ Play            |  [ timeline + keyframes ]     |
|  ⬇ Export          |  [ contextual keyframe bar ]  |
+--------------------+-------------------------------+
```

- Audio panel (left): source + reactivity knobs, **always-on layer** (no exclusive
  mode that disables the timeline).
- **Single duration** field (left) drives both play and export.
- Play + Export buttons (left). Export reuses the single duration.
- Timeline / Graph (right, under canvas): the polished `TimelinePanel`, now
  **always visible here** rather than gated behind `kaleidoscope.enabled`.

### Paths (`/paths`)
Unchanged this cycle. Canvas hidden on this route.

## Implementation slices (each leaves the app working)

1. **Shell + tabs.** Create `/editor` and `/animate` routes; `/` → `/editor`.
   Move the canvas into the layout shell (shown on editor+animate, hidden on
   paths). Header tabs replace the Paths/About links. Editor = current sidebar
   minus Animation; Animate = the animation controls relocated **as-is**.
   *No behavior change — pure reorganization.*
2. **Consolidate Animate.** Merge the three surfaces into one Animate layout;
   make the timeline always-visible there (drop the `kaleidoscope.enabled` gate
   for the panel's presence within Animate).
3. **Single duration.** Unify `durationSec` and `exportDurationSec` into one
   duration used by both playback and export. Remove the duplicate control.
4. **Audio as always-on layer.** Replace the exclusive `mode` dropdown UX so
   audio-reactivity coexists with the kaleidoscope timeline (the runtime already
   layers them; this is the UI/state-shape change to stop treating audio as
   mutually exclusive with the timeline).
5. **Graph Editor polish in Animate.** Default-select a parameter that already
   has keyframes; finish §2a from the report.

*Later cycle (own brainstorm): 6. Paths-as-archive + shape presets. 7. Animation presets.*

## Open questions to resolve during planning

- **Slice 4 state shape.** Decoupling audio from the exclusive `mode` selector is
  the most delicate change. `animationState.mode` currently also carries `simple`
  (morph) and `dataSeries`, which *are* alternative reactive layers. Planning must
  decide how audio-reactivity becomes always-available while morph/data remain
  selectable — without breaking the runtime that already layers keyframes on top.
- **Canvas-in-layout vs `/paths`.** The layout must hide the canvas on `/paths`
  (and `/about`) — confirm the flag mechanism (route-derived) during planning.
- **`kaleidoscope.enabled` flag.** Today it gates the TimelinePanel's existence.
  In Animate the panel is always present; decide whether the flag still gates
  anything (e.g. the kaleidoscope transform itself) or is retired.

## Out of scope (this cycle)

- Paths archive / shape presets / animation presets.
- Any change to the kaleidoscope keyframe model, ring morph math, or audio DSP.
- Restyling beyond what relocation requires.

## Test strategy

- Each slice keeps `bun run test:unit -- run` green (372 tests today) and
  `bun run check` at 0 errors; every `.svelte` passes svelte-autofixer (`issues: []`).
- New routes get smoke specs (route renders, tab nav works, canvas present on
  editor+animate / absent on paths).
- Slice 3 (single duration) and slice 4 (audio layering) get unit tests asserting
  the unified duration drives both play+export, and that audio + keyframes apply
  together on the same tick.
