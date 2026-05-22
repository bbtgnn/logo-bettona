# Path Manager — Design

Date: 2026-05-22
Status: Draft

## Goal

Provide a persistent, append-only library of shape paths that the user can build up over time from the Ring Editor and later re-apply to any ring. Solves the problem of losing path variants when iterating: today, modifying a ring's path replaces the prior shape. With the library, the user can bookmark a path snapshot before experimenting.

## Scope

In scope:

- Dedicated page at `/paths` showing all saved entries with previews.
- Save action in Ring Editor: capture current ring's `templatePath` + `secondaryTemplatePath` into a new library entry.
- Load action in Ring Editor: pick an entry from the library and apply to a chosen slot of the current ring.
- localStorage persistence via the project's existing `rune-sync` pattern.
- Reusable thumbnail component used by the page and the load modal.

Out of scope (explicit non-goals):

- Rename, delete, edit, tag, search of entries.
- SVG import directly into the library (entries are only created from existing rings; users still import SVGs through the Ring Editor as today).
- Internal hand-drawing path editor.
- Drag-and-drop apply.
- Undo/redo for library actions.
- Live binding between entries and rings — apply takes a snapshot.

## Data model

Additions to `src/lib/types.ts`:

```ts
export type PathLibraryEntry = {
  id: string;            // crypto.randomUUID()
  name: string;          // auto: `Path ${entries.length + 1}` at creation time
  createdAt: number;     // Date.now()
  path: Path;            // primary template
  secondaryPath: Path | null;
};

export type PathLibrary = {
  entries: PathLibraryEntry[];
};
```

Entries are immutable after creation. The library is append-only — there are no delete/edit operations. Auto-incremented names use entries.length at creation time; because we never delete, names stay unique without further bookkeeping.

## State module

New file: `src/lib/state/path-library.ts`

```ts
import { lsSync } from 'rune-sync/localstorage';
import type { Path, PathLibrary, PathLibraryEntry, Ring } from '$lib/types';

export const pathLibrary = lsSync<PathLibrary>('path-library', { entries: [] });

export function saveEntry(path: Path, secondaryPath: Path | null): PathLibraryEntry;

export function applyEntryToRing(
  ring: Ring,
  entry: PathLibraryEntry,
  slot: 'template' | 'secondary' | 'both'
): void;
```

Implementation notes:

- `saveEntry` deep-clones `cmds`/`crds` arrays before storing, so subsequent edits to the ring do not mutate the library.
- `applyEntryToRing` deep-clones in the other direction, so editing the ring after apply does not corrupt the entry.
- `slot === 'template'` writes `entry.path` into `ring.templatePath`.
- `slot === 'secondary'` writes `entry.path` into `ring.secondaryTemplatePath` (intentionally the primary path; the user is choosing which slot to fill). `entry.secondaryPath` is ignored in this case.
- `slot === 'both'` writes `entry.path` into `templatePath` and `entry.secondaryPath` into `secondaryTemplatePath`. This option is only valid when `entry.secondaryPath !== null` (the UI disables it otherwise).

## Geometry helpers

New file: `src/lib/geometry/path-to-svg.ts`

```ts
export function pathToSvgD(path: Path): string;
export function pathBoundingBox(path: Path): { x: number; y: number; w: number; h: number };
```

- `pathToSvgD` iterates `cmds`, consuming `crds` per command arity (M=2, L=2, Q=4, C=6, Z=0) and produces a valid SVG `d` attribute string. Throws if `crds` length does not match the expected arity sum.
- `pathBoundingBox` scans `crds` as (x, y) pairs and returns min/max. This is an approximation for cubic/quadratic curves (it ignores handle extension), which is acceptable for thumbnails and viewBox sizing.

## Components

### `src/lib/components/PathThumbnail.svelte`

Props:

```ts
{ path: Path; secondaryPath?: Path | null; size?: number }
```

Behavior:

- Calls `pathBoundingBox(path)` to compute viewBox, adds ~10% padding.
- Renders `<svg viewBox=...><path d=pathToSvgD(path) fill="none" stroke="currentColor" /></svg>`.
- If `secondaryPath` is provided, renders a second `<path>` with reduced opacity (~0.4) as a visual hint that the entry has a morph target.
- On malformed path (helpers throw), catches and renders a placeholder (neutral box with `?`).

Used by both the `/paths` page grid and the load modal in the Ring Editor.

### `src/routes/paths/+page.svelte`

- Header: title "Path Library", entries count.
- Responsive CSS grid (3–5 columns) of cards.
- Each card: `PathThumbnail`, name, formatted `createdAt`, small "secondary" badge if `secondaryPath` present.
- Empty state copy: "Nessun path salvato. Salva dal Ring Editor."
- Adds a nav link in `src/routes/+layout.svelte` consistent with existing routes (`/about`, `/demo`, `/experiments`).

The page is browse-only — no click handlers beyond visual feedback. Applying entries happens from the Ring Editor.

### Ring Editor integration

Modifications to `src/lib/components/RingEditor.svelte`:

1. "Salva in libreria" button
   - Placed alongside existing path controls.
   - Disabled when `ring.templatePath == null`.
   - On click: `saveEntry(ring.templatePath, ring.secondaryTemplatePath)`; brief toast/feedback "Salvato come 'Path N'".

2. "Carica da libreria" button
   - Opens a modal (uses shadcn `Dialog` if already wired in the project; otherwise a minimal modal styled to match).
   - Step 1: grid of `PathThumbnail`s from `pathLibrary.entries`. Empty state copy: "Libreria vuota. Salva prima dal Ring Editor."
   - Step 2 (after selecting an entry): slot picker with three options — `Template`, `Secondary`, `Entrambi`. `Entrambi` is disabled if the selected entry has no `secondaryPath`. Confirm button calls `applyEntryToRing(ring, entry, slot)` and closes the modal.

## Errors and edge cases

- `templatePath == null` → save button disabled (no path to capture).
- Empty library → empty states in both the page and the modal.
- localStorage quota exceeded → wrap `saveEntry` write in `try/catch`; on failure surface a toast "Libreria piena" and leave the library unchanged.
- Malformed path during render → `PathThumbnail` shows a placeholder instead of crashing.
- No migration: the new `path-library` key defaults to `{ entries: [] }` for existing users.

## Testing

Unit tests (vitest, `*.svelte.spec.ts` colocated with sources):

- `src/lib/state/path-library.svelte.spec.ts`
  - `saveEntry` returns an entry with a unique id and appends to `pathLibrary.entries`.
  - `saveEntry` deep-clones `cmds`/`crds` (mutating the source after save does not change the entry).
  - `applyEntryToRing` respects each slot variant and deep-clones into the ring.
  - `applyEntryToRing` with `slot === 'both'` on an entry without `secondaryPath` is a misuse — the helper assumes the caller honored the UI guard; document this in code rather than handling at runtime.

- `src/lib/geometry/path-to-svg.spec.ts`
  - `pathToSvgD` produces correct strings for M, L, Q, C, Z combinations.
  - `pathToSvgD` throws on cmd/crd arity mismatch.
  - `pathBoundingBox` returns correct min/max for known fixtures.

- `src/lib/components/PathThumbnail.svelte.spec.ts`
  - Renders an `<svg>` with the expected `d` attribute.
  - Renders the secondary overlay path when `secondaryPath` is provided.
  - Renders placeholder when helpers throw.

Playwright (extends the existing `src/routes/demo/playwright/` pattern, or adds `src/routes/paths/playwright/`):

- Visiting `/paths` with an empty library shows the empty state.
- From the Ring Editor: save current ring path → navigate to `/paths` → one entry visible with correct thumbnail.
- From the Ring Editor: open load modal → pick entry → choose `Template` → confirm → ring's `templatePath` updated.

## File summary

New files:

- `src/lib/state/path-library.ts`
- `src/lib/state/path-library.svelte.spec.ts`
- `src/lib/geometry/path-to-svg.ts`
- `src/lib/geometry/path-to-svg.spec.ts`
- `src/lib/components/PathThumbnail.svelte`
- `src/lib/components/PathThumbnail.svelte.spec.ts`
- `src/routes/paths/+page.svelte`
- (optional) `src/routes/paths/playwright/*.spec.ts`

Modified files:

- `src/lib/types.ts` — add `PathLibraryEntry`, `PathLibrary`.
- `src/lib/components/RingEditor.svelte` — add save + load controls.
- `src/routes/+layout.svelte` — add nav link to `/paths`.
