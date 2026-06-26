# Design — Curve editor: grid controls & drag mechanics

**Date:** 2026-06-26
**Component focus:** `src/lib/components/RingCanvas.svelte` (the curve/points editor) and its consumers.

## Problem

The curve editor's grid controls currently sit **above** the canvas and conflate two
ideas: the grid is always visible, and holding **Shift** snaps points to it. We want:

1. Move the controls **below** the drawing area, grouped as "Grid options":
   - **Visible** — on/off toggle (show/hide the grid)
   - **Snap** ("Aggancia") — on/off toggle (anchors/handles snap to the grid while dragging)
   - **Density** — slider (cells per axis)
2. Re-task **Shift**: it no longer snaps. Shift now **constrains movement to 45°
   axes** (horizontal / vertical / diagonal), matching Illustrator / InDesign /
   Photoshop. Snap becomes the dedicated "Snap" toggle.

These two mechanics **combine**: with Snap on and Shift held, constrain to 45° first,
then snap the result to the grid.

## Decisions (from brainstorming)

- **Scope/persistence:** grid options are stored **per curve** (on each custom
  `PathLibraryEntry`). Absent ⇒ defaults.
- **Defaults:** Visible **ON**, Snap **OFF**, density **8**.
- **Toggle UI:** shadcn **Switch** (add via `bunx shadcn-svelte add switch`).
- **Snap + Shift:** **combine** (45° constraint, then grid snap).
- Editor section (RingEditor / RingMorphConfigItem) reuses the same component with
  **ephemeral** local options — no per-object persistence (that section is being
  reworked separately later).

## Architecture

### Data model
```ts
// src/lib/types
export type GridOptions = { visible: boolean; snap: boolean; density: number };
export const DEFAULT_GRID_OPTIONS: GridOptions = { visible: true, snap: false, density: 8 };

// PathLibraryEntry gains:
gridOptions?: GridOptions; // absent ⇒ DEFAULT_GRID_OPTIONS
```

### State ownership — controlled component
`RingCanvas` becomes **controlled** for grid options (mirrors its existing `onchange`
for the path). It holds no internal option state.

```ts
// RingCanvas props
{
  templatePath: Path | null;
  onchange?: (path: Path) => void;
  gridOptions: GridOptions;
  ongridoptionschange?: (opts: GridOptions) => void;
}
```

- `CustomCurveItem`: passes `entry.gridOptions ?? DEFAULT_GRID_OPTIONS`; on change calls
  a new `updateEntryGridOptions(entry.id, opts)`.
- `RingEditor` / `RingMorphConfigItem`: keep `let gridOptions = $state(DEFAULT_GRID_OPTIONS)`
  locally and pass it; changes are ephemeral.

### path-library
New `updateEntryGridOptions(id: string, opts: GridOptions): void` — mirrors
`updateEntryPath`: maps entries, guards `!builtin`, writes a fresh object (no mutation).

## Drag mechanics

Pure geometry extracted to a testable module `src/lib/geometry/grid-snap.ts`:

```ts
type Grid = { left: number; top: number; stepX: number; stepY: number };

/** Nearest grid intersection to p. */
export function snapToGrid(p: { x: number; y: number }, grid: Grid): { x: number; y: number };

/** Constrain the vector (p - origin) to the nearest multiple of 45°, preserving its length. */
export function constrainTo45(
  origin: { x: number; y: number },
  p: { x: number; y: number }
): { x: number; y: number };
```

`constrainTo45`: angle = atan2(dy, dx); snapped = round(angle / 45°) * 45°; length =
hypot(dx, dy); return origin + (cos, sin) * length.

`RingCanvas.draw()` wires them per drag handler (anchor, out-handle, in-handle):

- **On `onMouseDown`**: record the dragged element's start view-space position.
- **On `onMouseDrag`**: target = `ev.point` (absolute cursor, view space), then:
  1. **Shift** ⇒ `target = constrainTo45(origin, target)`
     - **Anchor**: origin = the anchor's position at drag start.
     - **Handle**: origin = its anchor's current view position (handle stays on a 45°
       axis relative to its anchor).
  2. **Snap toggle on** ⇒ `target = snapToGrid(target, grid)` (works even when the grid
     is hidden).
  3. **Clamp** within the padded bounds.
- Neither Shift nor Snap ⇒ free drag (delta-based, as today).

Shift state read from the underlying DOM event (`(ev as unknown as { event: MouseEvent }).event?.shiftKey`),
as already done in the current code.

**Grid rendering**: drawn only when `gridOptions.visible`. Step derived from
`gridOptions.density` (cells per axis), slider range 2–16.

## UI & copy

Controls moved **below** the canvas:

```
┌───────────────────────────┐
│        [  canvas  ]       │   ← drawing area (320 internal, padding 16)
└───────────────────────────┘
 Grid options
   Visible             ●━○
   Snap                ○━●
   Density   ──●─────────  8
 Hold SHIFT to constrain to 45°
```

- Header "Grid options" (small, muted).
- Row Visible + Switch (`data-testid="grid-visible-toggle"`).
- Row Snap + Switch (`data-testid="grid-snap-toggle"`).
- Row Density + Slider (reused, `data-testid="grid-density-slider"`).
- Hint below: "Hold SHIFT to constrain to 45°".

### i18n keys (en / it)
- `tracciati_grid_options` — "Grid options" / "Opzioni griglia"
- `tracciati_grid_visible` — "Visible" / "Visibile"
- `tracciati_grid_snap` — "Snap" / "Aggancia"
- `tracciati_grid_density` — existing ("Grid density" / "Densità griglia"), reused
- `tracciati_grid_constrain_hint` — "Hold SHIFT to constrain to 45°" / "Premi SHIFT per vincolare a 45°"
- Remove orphaned `tracciati_grid_snap_hint` (old shift=snap copy).

## Testing

- **`grid-snap.spec.ts`** (node, pure): `snapToGrid` (nearest intersection across
  several steps/offsets); `constrainTo45` (the 8 principal directions + half-angle
  rounding cases + length preservation).
- **path-library spec**: `updateEntryGridOptions` persists on a custom entry, is a
  no-op on builtins, and writes a fresh (non-mutating) object.
- **`CustomCurveItem.svelte.spec.ts`**: Visible/Snap switches render; toggling a switch
  persists into `entry.gridOptions`; density slider present.
- **`RingEditor.svelte.spec.ts`**: already anchored to `grid-density-slider` — stays green.
- Interactive paper.js drag (45° / snap) is not unit-covered (as today) — verify live.

Gate: `bun run check` 0/0, `test:unit` green, svelte-autofixer clean on touched
`.svelte` components.

## Out of scope

- Editor / Animate sections: only the ephemeral wiring above; no redesign.
- Persisting grid options on the `Ring` object (custom curves only for now).
- Reduced-motion / accessibility beyond shadcn Switch defaults.
