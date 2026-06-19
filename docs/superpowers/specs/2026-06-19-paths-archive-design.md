# Spec — Paths as a two-column archive (cards + centered preview + apply)

**Date:** 2026-06-19
**Branch:** `feat/kaleidoscope` (continues after the tool restructure)
**Status:** Approved design (brainstorm complete). Next: implementation plan.
**Context:** Follow-up to `docs/superpowers/specs/2026-06-19-tool-restructure-design.md`. That spec deferred "Paths as archive" to a later cycle (slices 6–7); this is that cycle, narrowed to: two-column layout + shape preview + apply-to-ring.

## Goal

Rework `/paths` from a thumbnail grid into a two-column archive matching the
Editor/Animate shell: saved shapes stacked as cards in a left sidebar, a large
preview of the selected shape in the center, and an **Apply** action that writes
the shape onto a chosen ring + slot of the current mark.

## Background — what exists today

- `src/routes/paths/+page.svelte`: a header (now `WorkspaceNav` + "Path Library" +
  count) over a responsive **grid** (`data-testid="paths-grid"`) of `PathThumbnail`
  cards; hovering a card shows a `RingPreview` popover (`data-testid="path-preview-popover"`).
- `/paths` lives **outside** the `(app)` route group, so it does not inherit the
  persistent live-mark canvas — correct, since Paths shows saved shapes, not the mark.
- State/helpers (reused as-is):
  - `pathLibrary` (`src/lib/state/path-library.ts`): `{ entries: PathLibraryEntry[] }`.
    `PathLibraryEntry` has `id`, `name`, `createdAt`, `path: Path`, `secondaryPath: Path | null`.
  - `applyEntryToRing(ring: Ring, entry: PathLibraryEntry, slot: ApplySlot): void` and
    `type ApplySlot = 'template' | 'secondary' | 'both'`. `secondary`/`both` require
    `entry.secondaryPath`.
  - `composition.rings: Ring[]`, `composition.baseRadius`, `composition.ringIncrement`.
  - `RingPreview` props: `path` (required), `secondaryPath?`, `baseRadius`,
    `ringIncrement`, `size?`. `PathThumbnail` props: `path`, `secondaryPath`, `size`.
  - `WorkspaceNav` (tabs), shadcn `Sidebar*`, shadcn `Sheet` (used by `LibraryPickerSheet`).
- e2e today: `paths/path-manager.e2e.ts` (uses `paths-grid`), `paths/hover-preview.e2e.ts`
  (tests the hover popover — to be removed; the centered preview replaces it).

## Decisions (from brainstorm)

| Topic | Decision |
|---|---|
| Where Paths lives | Stays its **own page** (not in `(app)`), but rebuilt with the **same shell chrome** (shadcn `Sidebar` + `WorkspaceNav` tab header) so it looks consistent with Editor/Animate. It does NOT use the live-mark `PreviewCanvas`. |
| Center | Large `RingPreview` of the **selected** entry. Defaults to the first entry; empty state when the library is empty. |
| Left column | Saved shapes stacked **vertically** as cards (not a grid): thumbnail + name + date + `secondary` badge. Selected card highlighted. |
| Hover popover | **Removed** — the stable centered preview replaces it. |
| Apply | Button under the preview opens a **ring + slot picker** (Sheet): choose ring (1…N) + slot (Principale/Secondaria/Entrambe, with Secondaria/Entrambe disabled when the entry has no `secondaryPath`), confirm → `applyEntryToRing`. Disabled (with a hint) when there are no rings. |

## Target layout

```
PATHS   [ Editor ] [ Animate ] [ *Paths* ]              About
+----------------------+-------------------------------+
| Forme (3)            |                               |
| [▣ forma 1]          |     RingPreview (selected)    |
| [▣ forma 2] ← sel    |        (large, centered)      |
| [▣ forma 3]          |                               |
|                      |     [ Applica ]               |
+----------------------+-------------------------------+
```

## Components

- **`src/routes/paths/+page.svelte`** (rewritten): owns selection state
  (`selectedId`, defaults to `pathLibrary.entries[0]?.id`), renders the shell
  chrome, the cards list (left), and the centered preview + Apply button.
  - Cards list: `data-testid="paths-list"`; each card `data-testid="paths-card-{id}"`,
    `aria-current` / highlighted when selected; clicking sets `selectedId`.
  - Empty state: `data-testid="paths-empty-state"` (keep the existing testid + copy).
  - Center: `RingPreview` for the selected entry, sized large (e.g. 360), using
    `composition.baseRadius` / `composition.ringIncrement`.
  - Apply button: `data-testid="paths-apply"`, disabled when no entry selected or
    `composition.rings.length === 0`; shows a hint when no rings.
- **`src/lib/components/ApplyToRingSheet.svelte`** (new): a shadcn `Sheet` that,
  given the selected `PathLibraryEntry`, lets the user pick a ring and a slot, then
  calls back. Props:
  - `open: boolean` (bindable), `entry: PathLibraryEntry | null`,
    `rings: Ring[]`, `onapply: (ringIndex: number, slot: ApplySlot) => void`.
  - Ring selector: `data-testid="apply-ring-select"` (a `<select>` of ring indices,
    labelled "Anello 1…N"). Slot radios reuse the `LibraryPickerSheet` pattern
    (`template`/`secondary`/`both`; `both`/`secondary` disabled and auto-corrected to
    `template` when `entry.secondaryPath` is null). Confirm button
    `data-testid="apply-confirm"`.
  - The page's `onapply` handler calls `applyEntryToRing(rings[ringIndex], entry, slot)`
    and closes the sheet.

## Implementation slices (each leaves the app working)

1. **Two-column Paths.** Rewrite `/paths` into the shell chrome + vertical cards
   list + centered `RingPreview` of the selected entry (default first) + empty state.
   Remove the grid and the hover popover. Update `path-manager.e2e.ts` to the new
   `paths-list`/`paths-card-{id}` testids; delete `hover-preview.e2e.ts`.
2. **Apply to ring.** Add the Apply button + `ApplyToRingSheet` (ring + slot picker)
   wired to `applyEntryToRing`.

## Out of scope (this cycle)

- Shape **presets** / authoring new shapes from Paths.
- Animation presets.
- Reordering / renaming / deleting entries from Paths (save/delete still happen in
  the Ring editor as today).
- Moving `/paths` into the `(app)` group or any change to the Editor/Animate
  persistent canvas.

## Test strategy

- Unit (`vitest-browser-svelte`): Paths page renders a card per entry, clicking a
  card updates the selected preview, empty state when no entries; `ApplyToRingSheet`
  lists rings, disables Secondaria/Entrambe without a secondary path, and confirm
  invokes `onapply` with the chosen ring index + slot. Assert structure / testids /
  `aria-current` / call args — never layout (Tailwind not loaded in the test DOM).
- `pathLibrary` is a persisted singleton: specs that add entries must reset it in
  `beforeEach`/`afterEach` to avoid cross-test leakage.
- e2e: `path-manager.e2e.ts` updated to navigate the new list and apply; the suite
  stays green on `bun run test:unit -- run` and `bun run check` (0 errors); every
  `.svelte` passes `svelte-autofixer` (`issues: []`).
