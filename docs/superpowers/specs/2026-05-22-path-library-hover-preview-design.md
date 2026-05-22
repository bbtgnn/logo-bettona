# Path Library Hover Preview — Design

Date: 2026-05-22
Status: Draft

## Goal

Show a larger, realistic preview of how each library entry will look when applied as a ring (path repeated `copies` times around a circle) when the user hovers over a card in the Path Library page and in the load-from-library picker sheet. The bare-path thumbnail in the card stays as the at-a-glance representation; the hover preview adds the "this is what it actually becomes when you use it" view.

## Scope

In scope:

- Reusable `RingPreview.svelte` component that renders a single ring (path + secondary + morph) into a Paper.js scope using the existing `createRenderPipeline()`.
- Hover popover wired into:
  - `src/routes/paths/+page.svelte` — each grid card.
  - `src/lib/components/LibraryPickerSheet.svelte` — each picker grid card.
- Composition parameters (`baseRadius`, `ringIncrement`) read from the existing `composition` store. `copies`, `morphT`, `ringHeight`, color are hardcoded sensible defaults inside `RingPreview` (decoupled from user state).
- Lazy mount: the preview's Paper.js scope is created when the popover opens and disposed when it closes.

Out of scope (explicit non-goals):

- Animated morph (`morphT` cycling 0→1).
- Pre-rendering all entries to PNG/SVG at page load.
- Popover collision detection / viewport-edge re-positioning.
- Touch/mobile hover handling.
- Reactivity to composition changes while a popover is open (popover closes on mouseleave, reopens on re-hover with fresh values).
- Cache of rendered previews across hovers.

## Architecture

A new `RingPreview` component owns its own Paper.js scope and constructs an ad-hoc `Composition` from its props. It uses the existing `createRenderPipeline()` once on mount and disposes on unmount. Consumers (the `/paths` page and the picker sheet) wrap each card in a minimal hover-managed `<div>` and conditionally render `<RingPreview>` inside an absolutely positioned popover element. No shared state, no global preview cache, no animation loop.

## Components

### `src/lib/components/RingPreview.svelte`

Props:

```ts
{
  path: Path;
  secondaryPath?: Path | null;
  copies?: number;        // default 8
  baseRadius: number;
  ringIncrement: number;
  morphT?: number;        // default 0
  size?: number;          // default 280
}
```

Internals:

- Uses `$props()` for the prop block above.
- Holds a `canvas` element reference via `bind:this` and a local `paper.PaperScope`.
- On mount (Svelte `onMount` callback — the canvas binding is guaranteed populated by then):
  1. Create `scope = new paper.PaperScope()`.
  2. `scope.setup(canvas)`.
  3. Build the ad-hoc `Composition`:
     ```ts
     const composition: Composition = {
       baseRadius,
       ringIncrement,
       rings: [{
         copies,
         color: '#000000',
         templatePath: path,
         secondaryTemplatePath: secondaryPath ?? null,
         morphT,
         ringHeight: 0.12
       }],
       monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
       fullPalettes: []
     };
     ```
  4. `const pipeline = createRenderPipeline()`.
  5. Wrap the render in try/catch:
     ```ts
     try {
       pipeline.render({ composition, scope, viewport: { width: size, height: size, padding: 20 } });
       hasError = false;
     } catch {
       hasError = true;
     }
     ```
- On destroy:
  - `pipeline.dispose()`
  - `scope.project.clear()`
  - `scope.view.remove()`
- No reactivity to prop changes. The component re-mounts on each fresh hover, so it always sees fresh props.

Markup:

```svelte
{#if hasError}
  <div
    style:width="{size}px"
    style:height="{size}px"
    class="flex items-center justify-center border border-dashed text-muted-foreground text-sm"
  >
    ?
  </div>
{:else}
  <canvas bind:this={canvas} width={size} height={size} aria-hidden="true"></canvas>
{/if}
```

The `hasError` flag is initialized `false`, so on initial render the `<canvas>` is mounted (with `bind:this`). In `onMount`, the pipeline runs; if it throws, the catch sets `hasError = true`, Svelte re-renders, and the `<canvas>` is replaced by the placeholder block. Net result: on success the canvas stays, on failure it is swapped out for the `?` placeholder within the same frame.

## Popover integration

A small, ad-hoc CSS popover — no new shadcn component, no `bits-ui` dependency. Each consumer manages a `hoveredId` `$state` and renders the popover inside the card when it matches.

### `/paths +page.svelte`

Adds:

```ts
import { composition } from '$lib/state/composition';
import RingPreview from '$lib/components/RingPreview.svelte';

let hoveredId = $state<string | null>(null);
```

Each card's `<li>` becomes:

```svelte
<li
  class="relative flex flex-col items-center gap-2 rounded border p-3"
  onmouseenter={() => (hoveredId = entry.id)}
  onmouseleave={() => (hoveredId = null)}
>
  <PathThumbnail ... />
  ...
  {#if hoveredId === entry.id}
    <div
      class="absolute left-full top-0 z-10 ml-2 rounded border bg-popover p-2 shadow-lg"
      data-testid="path-preview-popover"
    >
      <RingPreview
        path={entry.path}
        secondaryPath={entry.secondaryPath}
        baseRadius={composition.baseRadius}
        ringIncrement={composition.ringIncrement}
        size={280}
      />
    </div>
  {/if}
</li>
```

### `LibraryPickerSheet.svelte`

The picker grid (the `!selected` branch) gets the same treatment with a smaller `size` (e.g. 220) to fit the sheet width. Same `hoveredId` pattern, same `data-testid="path-preview-popover"`. The selected-entry detail view does NOT get hover preview (it's already a focused view).

## Composition parameters source

`baseRadius` and `ringIncrement` are read from the existing `composition` rune-sync store. Reads are evaluated at popover open time (when `RingPreview` mounts), so the preview reflects the user's current editor settings without being subscribed.

Fixed defaults inside `RingPreview` (not from any entry or store):

- `copies = 8`
- `morphT = 0`
- `ringHeight = 0.12`
- color = `#000000`, bg palette `#ffffff`

This decouples the preview from `colorMode` and from per-ring settings, which would otherwise produce confusing previews ("the entry has no color, why is it red here?"). The trade-off: previews don't reflect color choices. Acceptable — the library is about shape, not color.

## Errors and edge cases

- Path malformed (cmd/crd arity mismatch) → render pipeline throws → caught → placeholder `?` rendered.
- Secondary path incompatible with primary → `validatePathCompatibility` rejects → pipeline throws → caught → placeholder.
- `composition.baseRadius == 0` or other degenerate viewport → pipeline throws → placeholder.
- Rapid hover in/out → component mounts and unmounts immediately. Each `RingPreview` owns its scope; dispose is synchronous. No leak.
- Popover near the right edge of the viewport → may visually overflow. Out of scope for v1.
- Composition changes (e.g. user has another tab updating `baseRadius`) while popover is open → not reflected until the popover closes and reopens. Acceptable.

## Testing

Unit (vitest, `*.svelte.spec.ts`):

- `src/lib/components/RingPreview.svelte.spec.ts`
  - Renders a `<canvas>` element when mounted with a valid path.
  - Renders the `?` placeholder when mounted with a path that the pipeline rejects (e.g. mismatched arity). Use a spy on `createRenderPipeline` to inject a throw, OR construct a path the real pipeline will reject.
  - Calls `pipeline.dispose()` on unmount. Use a spy on `createRenderPipeline` to assert the returned `dispose` is invoked.

Playwright (extend `src/routes/paths/path-manager.e2e.ts` with a new test, or add `src/routes/paths/hover-preview.e2e.ts`):

- With a non-empty library, hover over the first card on `/paths`. Assert `[data-testid="path-preview-popover"]` is visible and contains a `<canvas>`. `mouseleave` from the card. Assert the popover is hidden.

## File summary

New files:

- `src/lib/components/RingPreview.svelte`
- `src/lib/components/RingPreview.svelte.spec.ts`
- (optional) `src/routes/paths/hover-preview.e2e.ts` — alternatively add a test inside the existing `path-manager.e2e.ts`.

Modified files:

- `src/routes/paths/+page.svelte` — `hoveredId` state, hover handlers, popover markup, imports for `RingPreview` and `composition`.
- `src/lib/components/LibraryPickerSheet.svelte` — same hover treatment on the picker grid (smaller `size`). Imports for `RingPreview` and `composition`.
