done: false
---

## Problem Statement

A designer wants to create complex radially-symmetric shapes (e.g. logos, mandalas, decorative rings) by drawing a simple template path and having the app automatically tile and bend it into a full circular composition. Doing this manually in a vector editor is tedious and error-prone — adjusting copies or proportions requires redoing all transformations by hand.

## Solution

A single-page SvelteKit app where the user builds a **Composition** made of one or more **Rings**. Each Ring is defined by a template SVG path that gets geometrically bent over a circular arc and tiled radially. The app provides a real-time paper.js preview of the full composition. The result can be exported as an SVG file.

## User Stories

1. As a designer, I want to create a new composition so that I can start building my shape from scratch.
2. As a designer, I want to add a new ring to my composition so that I can build up layers of circular shapes.
3. As a designer, I want to upload an SVG file as the template for a ring so that I can use paths I've drawn in another tool.
4. As a designer, I want the app to extract the first path from my SVG and display it in the ring's canvas so that I can confirm the correct shape was imported.
5. As a designer, I want to see an inline error message if my uploaded SVG contains no paths so that I understand why the import failed.
6. As a designer, I want the previously loaded path to remain unchanged if a new SVG upload fails so that I don't lose my work.
7. As a designer, I want to set the number of copies for a ring (integer ≥ 1) so that I can control how many times the shape repeats around the circle.
8. As a designer, I want to set the ring height (0–1) via a slider so that I can control how thick the ring is relative to the base radius.
9. As a designer, I want to pick a color for each ring so that I can distinguish and style the layers of my composition.
10. As a designer, I want to collapse and expand each ring's editor panel so that I can keep the sidebar tidy when working with many rings.
11. As a designer, I want to reorder rings in the sidebar so that I can control which ring appears innermost (drawn on top).
12. As a designer, I want the ring at index 0 to be the innermost (smallest radius) ring, drawn on top, so that my composition layers make visual sense.
13. As a designer, I want to set the base radius of the composition so that I can control the overall size of the innermost ring.
14. As a designer, I want to set the ring increment so that I can control the spacing between successive rings.
15. As a designer, I want to see a real-time preview of the full composition in a fixed 600×600 canvas so that I can evaluate changes instantly.
16. As a designer, I want the preview to update immediately on any change without debouncing so that I get instant visual feedback.
17. As a designer, I want the preview canvas to auto-scale the composition to fit so that I always see the full shape regardless of radius values.
18. As a designer, I want rings with no template path yet to be silently excluded from the preview so that I can add rings without breaking the canvas.
19. As a designer, I want to delete a ring from the composition so that I can remove shapes I no longer want.
20. As a designer, I want my composition to be automatically saved to localStorage so that I don't lose my work on page refresh.
21. As a designer, I want the app to start with an empty composition if no saved state exists so that I begin with a clean slate.
22. As a designer, I want to export the final composition as an SVG file so that I can use it in other tools.
23. As a designer, I want the exported SVG to faithfully represent what I see in the preview canvas so that there are no surprises.
24. As a designer, I want sharp corners at copy boundaries when my template path has non-zero endpoint handle angles so that I can create intentionally jagged or angular repeating shapes.
25. As a designer, I want smooth joins at copy boundaries when my template path has zero endpoint handle angles so that I can create seamless repeating shapes.
26. As a designer, I want each ring's template path displayed in its own isolated paper.js canvas so that there is no visual interference between ring previews.
27. As a designer, I want the per-ring canvas to only render when the ring panel is expanded so that hidden rings don't consume resources.

## Implementation Decisions

### Data Structures

- `Path`: `{ cmds: string[], crds: number[] }` — command/coordinate representation of an SVG path.
- `Ring`: `{ copies: number, color: string, templatePath: Path | null, ringHeight: number }` — a single ring layer.
- `Composition`: `{ baseRadius: number, ringIncrement: number, rings: Ring[] }` — the full composition.
- Default values: `baseRadius: 100`, `ringIncrement: 50`.

### Modules

**`geometry/bend.ts`** — Core math module. Pure functions only, no side effects.
- Takes a `Ring` and computes the full paper.js path for one copy (bent template + mirrored bent template).
- Uses the tangent-space approach for Bezier handle transformation: decomposes each handle into radial and tangential components relative to its anchor, scales the tangential component by `r * dθ`, preserves the radial component.
- Collinearity of in/out handles through an anchor is preserved by this transformation (guaranteed by local linearity of the map).
- Sharp vs. smooth copy-boundary joins are determined by the template path's endpoint handle angles — no special-casing needed.
- Repeats the copy `ring.copies` times, assembling all into one continuous closed paper.js path.
- Each ring's effective radius is computed externally and passed in (not computed here).
- Input: `Ring`, `radius: number`, `PaperScope`. Output: `paper.Path`.

**`geometry/compose.ts`** — Assembles the full composition.
- Iterates over rings in index order, computing each ring's radius: `baseRadius + ringIncrement * index`.
- Calls `bend.ts` for each ring that has a `templatePath`.
- Draws rings in reverse order (highest index first) so index 0 renders on top.
- Input: `Composition`, `PaperScope`. Output: void (draws to scope).

**`geometry/svg-import.ts`** — SVG import pipeline.
- Accepts a `File`, uses paper.js to import and parse the SVG.
- Extracts the first path found, flattening all transforms into absolute coordinates.
- Converts the paper.js path to the internal `Path` (`cmds`/`crds`) format.
- Designed as a pipeline: exposes a `preprocessors` hook (array of `(item: paper.Item) => paper.Item` functions) that runs before path extraction, making it easy to add pre-processing steps later (e.g. normalize scale, simplify paths).
- Returns `Path | null` (null on failure).

**`state/composition.ts`** — Reactive state store.
- Uses `rune-sync` to persist the full `Composition` to localStorage.
- Exposes the composition state and mutation helpers (add ring, remove ring, update ring, reorder rings, update composition-level params).
- UI collapse state (which rings are expanded) stored as a separate localStorage key.

**`components/PreviewCanvas.svelte`** — Main 600×600 preview canvas.
- Owns its own `PaperScope`.
- Uses a Svelte `$effect` to watch the full composition state and trigger a full redraw (no debounce).
- Auto-scales the composition to fit the canvas on each redraw.

**`components/RingCanvas.svelte`** — Per-ring template preview canvas.
- Owns its own `PaperScope` (set up on `onMount`, torn down on unmount).
- Display-only: shows the raw template path, no interaction.
- Rendered only when the ring panel is expanded.

**`components/RingEditor.svelte`** — Collapsible panel for one ring.
- Contains: SVG file input, `RingCanvas`, `copies` number input, `ringHeight` slider, color picker.
- Shows inline error on failed SVG import.
- Shows a placeholder in `RingCanvas` when no path is loaded yet.

**`components/Sidebar.svelte`** — Left sidebar.
- Shows `baseRadius` and `ringIncrement` number inputs at the top.
- "Add Ring" button.
- Ordered list of `RingEditor` panels, drag-to-reorder.

### Bending Math Detail

Given a template path with bounding box `[0, W] × [0, H]`:
- For each anchor point `(x, y)`:
  - `θ = (x / W) * alpha` where `alpha = π / copies` (half the arc per copy)
  - `r_normalized = lerp(1 - ringHeight, 1, y / H)`
  - Final position: polar `(r * r_normalized, θ)` centered at O
- For each handle `(hx, hy)` relative to anchor `(ax, ay)`:
  - Compute handle delta `(dx, dy)` in original space
  - Decompose into tangential component `dt = dx / W * alpha * r` and radial component `dr = dy / H * ringHeight * r`
  - Apply at the transformed anchor angle/radius
- Mirror by negating all angles
- Repeat by rotating by `2 * alpha * k` for k = 0..copies-1

### SVG Export

- Uses `paper.project.exportSVG()` from the preview `PaperScope`.
- Triggered by an "Export SVG" button.
- Downloads the file directly in the browser.

### Testing

- Tests focus on external behavior only, not implementation details.
- **`geometry/bend.ts`**: unit tests with known inputs (e.g. a straight horizontal line as template should produce a circular arc; a single-copy ring with a rectangular template should produce a specific bounding box). Test collinearity preservation for handles.
- **`geometry/svg-import.ts`**: unit tests for path extraction from sample SVG strings, pipeline hook application, and null return on invalid input.
- **`geometry/compose.ts`**: integration test — compose a known 2-ring composition and assert that the resulting paper.js project contains 2 paths with correct positions.
- No tests for Svelte components (UI behavior is covered by the design decisions above and would be brittle to test at this stage).

## Out of Scope

- Interactive path editing on the ring canvas (drag anchors/handles)
- Multi-path SVG import or path picking
- PNG export
- Undo/redo
- Sharing or cloud persistence
- Animation
- C1-smooth joins between copies (sharp corners are a feature)
- Any server-side logic (static site)

## Further Notes

- paper.js must always be imported as `import paper from "paper"` — never use the global variable.
- Each canvas (preview + per-ring) gets its own `PaperScope` to avoid interference.
- The `rune-sync` store serializes the full `Composition` including `Path` data; `Path` objects contain only plain arrays so serialization is trivial.
- Shadcn/svelte components should be used for all UI primitives (sidebar, sliders, inputs, color picker). Install new components as needed with `bunx shadcn@latest add <component> --yes`.
- File naming is kebab-case throughout.
- Prefer small functions that do one thing well; prefer composition over inheritance.
