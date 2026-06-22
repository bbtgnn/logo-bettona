# Editor & Animate bug fixes — design

**Date:** 2026-06-22
**Branch:** `feat/kaleidoscope`
**Status:** approved (design), pending implementation plan

## Context

A QA pass on the editor and animate surfaces surfaced three regressions/bugs. This
spec covers the **bug-fix phase only** (user-chosen ordering: bugs first, features
later). Two further batches are deferred and tracked separately:

- **Features batch** (later): PNG export with background toggle (Editor #3); per-ring
  preview in Audio Zones (Animate #4).
- **Morph refactor** (later): move the morph-target mechanic out of the Editor into
  the Animate surface (Animate #2). This is the *real* fix for bug #2 below; the fix
  here is an explicit stopgap.

Investigations from the QA list are already resolved and need no code:

- **"Tessera viva" / "Aggiorna istantanea"** live in `KaleidoscopeSection`, shown in
  both Editor and Animate. `liveTile` ON re-renders the kaleidoscope tile every frame
  from the live composition; OFF snapshots the tile once and reuses it.
  "Aggiorna istantanea" (shown only when `liveTile` is OFF) re-takes that snapshot.
- The canvas/kaleidoscope render is shared between routes (`preview-presenter`), so
  bug #1 affects both. The path editor (`RingCanvas`) is Editor-only today, so bug #2
  is Editor-only until the morph refactor moves editing into Animate.

## Bug 1 — Kaleidoscope canvas stretches on aspect-ratio change

### Symptom
With kaleidoscope enabled, changing the canvas aspect ratio stretches the drawing;
the canvas display box is not reshaped.

### Root cause (confirmed)
On a hi-DPI display (`devicePixelRatio !== 1`), paper.js `_setElementSize`
(`paper-core.js:13593`) sets the canvas **inline style** `width`/`height` in CSS px and
scales the 2D context by the pixel ratio at setup. In kaleidoscope mode the render
bypasses paper and the resize effect in `preview-presenter.svelte.ts` (the effect at
~`:218`) updates only the **pixel buffer** (`canvasEl.width` / `canvasEl.height`) from
`ratioToCanvasSize(aspectRatio)`. The inline `style.width`/`style.height` left behind
by paper stays at the old square size, so the new (e.g. portrait) buffer is squeezed
into the old display box → stretch. The kaleidoscope geometry itself
(`kaleidoscope.ts`) already centers the disc on the short side, so the geometry is not
at fault.

### Fix
In the kaleidoscope resize effect in `preview-presenter.svelte.ts`, when the canvas
dimensions change, set the inline `canvasEl.style.width` / `canvasEl.style.height`
(CSS px) to match the aspect-correct dimensions, alongside the existing buffer resize.
Optionally scale the pixel buffer by `devicePixelRatio` for Retina sharpness to match
flat mode (which gets this for free via paper). The simplest correct fix is to keep the
buffer at `ratioToCanvasSize(...)` and add the matching inline style; the DPR-sharpness
upgrade is a nice-to-have and may be folded in if it stays simple.

### Acceptance
- With kaleidoscope on, switching aspect ratio reshapes the canvas display box to the
  new ratio with no stretch/squash of the kaleidoscope.
- Flat (non-kaleidoscope) mode is unchanged.

## Bug 2 — Path-editor curves no longer editable when a morph target exists (stopgap)

### Symptom
In the path editor (`RingCanvas`), dragging curve handles no longer changes the path;
only "copies" and "ring height" still respond.

### Root cause (confirmed)
`updateRingPathVariant` (`composition.ts:187`) enforces strict structural
compatibility between primary and secondary when a secondary (morph target) exists:
`validatePathCompatibility` (`path-morph.ts:15`) requires identical command sequence
and coordinate length. The default composition now ships rings **with** morph targets,
so every primary edit is validated against the secondary. Dragging an **anchor** keeps
the structure (works), but dragging a **handle** that turns a straight segment into a
curve — or vice versa — changes the command/coordinate structure and is **rejected
silently** (only sets `ringPathError`). Hence "curves" specifically stop responding.

This is the same underlying tension as Animate #2: a primary structurally constrained
by a co-resident secondary. The real fix is the morph refactor; this is a stopgap.

### Fix (stopgap)
In `updateRingPathVariant`, `variant === 'primary'` branch: when the incoming path is
structurally **incompatible** with an existing secondary, do **not** reject. Instead,
apply the new primary **and** regenerate the secondary as a clone of the new primary
(same `cmds`/`crds`), keeping the pair morph-compatible.

- Non-structural edits (moving anchors/handles without adding/removing curves) stay
  compatible → the secondary is preserved untouched (no reseed).
- Structural edits (straight ↔ curve) reseed the secondary from the new primary. For
  the default rings (secondary identical to primary) this loses nothing. For a
  hand-designed morph target it resets the target — an accepted stopgap tradeoff,
  resolved properly by the morph refactor (Animate #2).

The `secondary` branch keeps its current strict behavior (editing a morph target must
stay compatible with the primary).

### Acceptance
- With a ring that has a morph target, dragging curve handles changes the primary path
  (structural changes allowed).
- After a structural primary edit, primary and secondary remain morph-compatible
  (`validatePathCompatibility` passes), so morph rendering does not break.
- A non-structural primary edit leaves a distinct secondary unchanged.
- Editing the secondary variant still rejects incompatible changes.

## Bug 3 — Timeline ruler misaligned with keyframe lanes

### Symptom
The timeline ruler does not line up with the keyframe bars; the per-track "+" button
causes the misalignment.

### Root cause (confirmed)
In `TimelinePanel.svelte` the ruler row is `[w-28 gutter][flex-1 ruler lane]`. In
`TimelineTrack.svelte` each track row is `[w-28 gutter][+ button][flex-1 lane]`. The
extra "+" button sits in the flex flow before the lane, so the track lane is narrower
and offset relative to the ruler lane. The playhead measures the ruler lane
(`laneColEl`) while keyframes measure the track lane (`rowEl`) — different widths →
playhead and diamonds disagree at the same time value.

### Fix
Move the "+" button out of the lane flow in `TimelineTrack.svelte` so the ruler lane
and every track lane share an identical left offset and width. Preferred: place the
"+" inside the `w-28` label gutter (e.g. label + "+" together within the fixed-width
column), leaving `[w-28 gutter][flex-1 lane]` in both rows. The ruler row needs no
change. Verify the playhead sits exactly on a keyframe added at the playhead.

### Acceptance
- Ruler ticks, playhead, and keyframe diamonds align at the same time value.
- Adding a keyframe at the playhead places the diamond exactly under the playhead line.
- Existing timeline tests still pass (adjust selectors only if the "+" moves).

## Out of scope (this spec)

- PNG export + background toggle (Editor #3).
- Audio Zones per-ring preview wiring + i18n (Animate #4).
- Morph-target relocation from Editor to Animate (Animate #2) — the definitive fix for
  bug #2.

## Testing notes

- Unit/component tests for bug 2 (`updateRingPathVariant` reseed behavior) and bug 3
  (layout/alignment via testids) where practical.
- Bug 1 is a display/CSS effect; verify via live browser check (kaleidoscope on +
  aspect-ratio switch) since the regression is in DOM sizing, not pure logic.
- Gates: `bun run check`, `bun run test:unit -- run`, `bunx playwright test`, and
  svelte-autofixer `issues: []` on every touched `.svelte` / `.svelte.ts`.
