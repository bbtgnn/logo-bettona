# Timeline UI Polish — Design

**Date:** 2026-06-19
**Branch:** `feat/kaleidoscope`
**Status:** Approved (designer)

## Goal

Improve the aesthetics and usability of the kaleidoscope animation timeline,
in a **clean / minimal** visual direction. No new animation capabilities —
this is a polish + interaction-fix pass over the existing timeline UI.

## Context

The timeline lives at the bottom of `src/routes/+page.svelte`
(`TimelinePanel.svelte`), full width, below the preview canvas. It drives
kaleidoscope keyframe animation built in Blocks 1–3.

Relevant existing pieces:

- `TimelinePanel.svelte` — collapsible panel; `open` + `graphMode` flags;
  derives `armedParams` from `keyframes.tracks[*].enabled`; renders ruler +
  tracks, or the graph editor, or an empty state.
- `TimelineRuler.svelte` — scrub bar; draws the playhead; **no tick marks or
  time labels**.
- `TimelineTrack.svelte` — one row per armed param: label, `+ Keyframe`,
  diamond lane (double-click / drag), interpolation `<select>`, `Elimina
  keyframe` button — **all controls always visible**.
- `kaleidoscope.enabled` (`src/lib/state/kaleidoscope.svelte.ts`) — master
  on/off for kaleidoscope mode.
- `animationState.durationSec` (default `3`) — maps normalized progress `0..1`
  to real seconds. `timeline-geometry.ts` does the `time ↔ x` mapping
  (normalized).

## Problems being fixed

1. Timeline is always present, even when kaleidoscope mode is off.
2. Ruler has no time reference — just a bar + playhead.
3. Playhead only spans the ruler, not the track lanes → hard to align
   keyframes to the current time.
4. Every track row is cluttered: name + `+ Keyframe` + lane + interp select +
   delete button, all always visible.
5. Keyframe selection is weak (color swap only); keyframe time position is hard
   to read precisely.
6. Header interaction is confusing: `Timeline` toggles the whole panel open/
   closed, and `Graph Editor` toggles a sub-mode. Opening Graph Editor then
   pressing `Timeline` **closes the panel** instead of returning to the track
   view.

## Design

### A. Conditional visibility

`TimelinePanel` renders nothing unless `kaleidoscope.enabled` is `true`.
When kaleidoscope mode is off, the panel and its bottom border are absent.

- Gate the whole `<section>` behind `{#if kaleidoscope.enabled}`.
- No change to keyframe state when toggling — disabling kaleidoscope only hides
  the UI; armed tracks/keyframes persist.

### B. Header: disclosure arrow + view tabs

Separate **open/close** from **which view**:

- A disclosure arrow (chevron, ▸ collapsed / ▾ expanded) sits next to the
  `Timeline` label and is the **only** control that opens/closes the panel
  (toggles `open`). The arrow is always visible (when the panel renders).
- `Timeline` and `Graph Editor` become **view tabs** that switch a single
  `view` state (`'tracks' | 'graph'`), not separate booleans. They no longer
  affect `open`.
  - Pressing `Timeline` → `view = 'tracks'` (returns to tracks; never closes).
  - Pressing `Graph Editor` → `view = 'graph'`.
- The active tab is visually indicated (e.g. `default` vs `ghost` button
  variant, as today).
- State change: replace `graphMode: boolean` with `view: 'tracks' | 'graph'`.
  Clicking the chevron toggles `open`. Tabs only show when `open`.

### C. Ruler with ticks + time labels

`TimelineRuler` gains evenly-spaced subtle tick marks and time labels derived
from `animationState.durationSec`:

- Labels at start / middle / end: `0s`, `{half}s`, `{durationSec}s`
  (e.g. `0s · 1.5s · 3s`). Format: trim trailing `.0` (show `3s` not `3.0s`,
  `1.5s` stays).
- Minor ticks at regular fractions (quarters) — thin, low-contrast.
- Ticks/labels are positioned via the existing normalized `xFromTime` mapping
  so they stay correct at any width.
- Scrub behavior unchanged.

### D. Continuous playhead

A single vertical playhead line spans the ruler **and** all track lanes.

- Lift the playhead to an overlay positioned over the combined ruler + tracks
  area (the `timeline-tracks` container), aligned to the same left origin as
  the lanes, at `xFromTime(animationState.progress, width)`.
- The ruler keeps its own scrub interaction; the visible playhead line is one
  continuous element across ruler + lanes (not one-per-row).
- Implementation note: ruler and lanes must share the same horizontal content
  box (same left padding / label-column offset) so a single `left` value lines
  up across both. The label column (track names) is a fixed-width gutter; the
  playhead overlay covers only the lane area to the right of that gutter.

### E. Per-row controls → contextual bar

Track rows are decluttered to: **name + lane + diamonds** only.

- `+ Keyframe` becomes a compact icon button (still adds a keyframe at the
  playhead). Stays on the row (small) or moves into the contextual bar — keep
  it on the row as a small icon for discoverability.
- Interpolation `<select>` and `Elimina keyframe` move out of every row into a
  **single contextual bar** rendered below the tracks, shown only when a
  keyframe is selected. The bar acts on the currently selected keyframe.
- Selection becomes panel-level: selecting a keyframe in any track sets a
  shared selection `{ paramId, keyframeId }`. The contextual bar reads/writes
  that selection (set interp, delete). This requires lifting selection state
  from `TimelineTrack` up to `TimelinePanel` (or a small shared store).
- Empty selection → no contextual bar (or a disabled hint). Deleting clears
  selection.

### F. Clearer keyframe selection + position

- Selected keyframe diamond gets a **blue ring/border** (azzurro) — distinct
  from the unselected fill. Use a Tailwind blue (e.g. `ring-2 ring-sky-400` /
  `border-sky-400`), independent of the theme `primary` so it reads as
  "selected" unambiguously.
- Larger click/hit area on diamonds (padding hit-box around the visual
  diamond) without enlarging the visual glyph much.
- **Position readout:** when a keyframe is selected (and/or hovered), show a
  thin vertical guide line at its time across the lane, plus its time value
  (e.g. `1.2s`, computed `kf.time * durationSec`) as a small label near the
  diamond. This makes the keyframe's exact time legible.

### G. Minimal spacing / color pass

- Roomier, softer lanes (taller rows, gentle rounding, low-contrast lane fill).
- Aligned name column (consistent fixed width across rows + ruler offset).
- Clean header (chevron + label + tabs) with consistent spacing.
- Reduce always-on visual noise; let the clean/minimal direction breathe.

## Out of scope (YAGNI)

- Zoom / horizontal scroll on the timeline.
- Snap-to-grid for keyframes.
- Editing `durationSec` from the timeline.
- Multi-keyframe selection.
- Reordering / hiding tracks.
- Any change to keyframe sampling / animation math.

## Testing

Existing specs touched: `TimelineRuler.svelte.spec.ts`,
`TimelineTrack.svelte.spec.ts`, `TimelinePanel.svelte.spec.ts`.

- **Visibility (A):** panel absent when `kaleidoscope.enabled` is false;
  present when true.
- **Header (B):** chevron toggles `open`; pressing `Timeline` while in graph
  view switches to tracks view and keeps the panel open; tabs reflect active
  view.
- **Ruler (C):** renders the expected time labels for a given `durationSec`;
  labels update when `durationSec` changes.
- **Playhead (D):** a single playhead element is positioned at the progress-
  derived `x`; assert it spans / aligns over the lanes.
- **Contextual bar (E):** interp select + delete are absent with no selection,
  present after selecting a keyframe; acting on them mutates the selected
  keyframe; delete clears selection.
- **Selection visual (F):** selected diamond carries the blue-ring class;
  selected keyframe shows its time label.

Cross-cutting (carried from Block 3):

- Shared `keyframes` singleton across the chromium browser-test project →
  specs that arm tracks MUST clean up (`afterEach` disarm / wipe), or they
  pollute `keyframes.svelte.spec.ts`.
- Query sliders/labels with `{ exact: true }` (substring collisions).
- Run the **full** unit suite before committing (`bun run test:unit -- run`);
  some failures only surface in the full chromium run.
- Every `.svelte` must pass `svelte-autofixer` MCP (`issues: []`). Known
  false-positive class: "function called/declared inside `$effect`" on
  canvas/rAF/ensure-track effects — ignore only those.

## Verification

- `bun run test:unit -- run` → all passing.
- `bun run check` → 0 errors.
- All touched `.svelte` → autofixer `issues: []`.
- **Live designer check** in `bun run dev`: timeline appears only with
  kaleidoscope on; chevron opens/closes; tab switching never closes the panel;
  ruler shows times; continuous playhead; selecting a keyframe shows blue ring
  + time + contextual bar; overall clean/minimal feel. Iterate look live.
  (Headless canvas screenshots are NOT trustworthy — DOM-only timeline is fine
  to inspect, but defer the final aesthetic sign-off to the designer.)
