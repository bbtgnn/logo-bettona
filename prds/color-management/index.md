done: false
---

## Problem Statement

The current color system only supports manual per-ring color assignment. There is no way to apply a consistent color scheme across all rings at once, no way to save and switch between color palettes, and no way to experiment with automated color distribution (alternating or randomized). This forces users to manually update every ring color individually when they want to try a new color scheme.

## Solution

Introduce three color modes — Monochrome, Palette, and Manual — selectable via a collapsible "Colors" section in the sidebar. Each mode drives automatic color assignment into the existing per-ring color field. Palettes are saved as part of the composition. The color mode and active palette index are tracked in a separate persistent store.

## User Stories

1. As a designer, I want to select a color mode (Monochrome, Palette, Manual), so that I can control how ring colors are assigned across the composition.
2. As a designer, I want the color mode to be remembered across sessions, so that I don't have to reconfigure it each time I open the app.
3. As a designer, I want to switch color modes instantly and see the rings update in real time, so that I can quickly compare different approaches.
4. As a designer, I want a Monochrome mode with a main and background color, so that I can create clean two-tone compositions.
5. As a designer, I want the outermost ring to always use the main color in Monochrome mode, so that the composition has a consistent outer boundary.
6. As a designer, I want the colors to alternate inward from the outermost ring in Monochrome mode, so that I get a predictable striped effect.
7. As a designer, I want to set the main and background colors using color pickers labeled "Main" and "Background", so that the semantic meaning of each color is clear.
8. As a designer, I want a Palette mode that assigns colors from a list across rings, so that I can apply multi-color schemes in one action.
9. As a designer, I want palette colors to be assigned so that no two adjacent rings share the same color, so that the composition remains visually distinct.
10. As a designer, I want palette colors to loop when the palette has fewer colors than rings, so that all rings always get a color.
11. As a designer, I want the palette assignment to be stored persistently, so that the composition looks the same across sessions and exports.
12. As a designer, I want a reshuffle button in Palette mode, so that I can randomize the color assignment when I want to explore variations.
13. As a designer, I want to see existing palettes as rows of color swatches, so that I can visually identify and select them.
14. As a designer, I want to click a palette swatch row to make it the active palette, so that switching palettes is intuitive.
15. As a designer, I want to add a new palette with a "New palette" button, so that I can build a library of color options within my composition.
16. As a designer, I want the palette text input to always be editable, so that I can refine the active palette at any time.
17. As a designer, I want to type comma-separated hex values into the palette input, so that I can precisely define colors.
18. As a designer, I want invalid hex values to be skipped (not the whole palette rejected), so that a typo doesn't wipe out my entire palette.
19. As a designer, I want the palette to fall back to black and white only if no valid hex values are found, so that the composition never renders without colors.
20. As a designer, I want to delete a palette from the list, so that I can remove palettes I no longer need.
21. As a designer, I want to be prevented from deleting the last palette, so that the composition always has at least one palette defined.
22. As a designer, I want Manual mode to keep the existing per-ring color pickers, so that I retain full individual control when needed.
23. As a designer, I want the per-ring color pickers in RingEditor to be hidden in Monochrome and Palette modes, so that the UI isn't confusing when colors are managed globally.
24. As a designer, I want multiple monochrome palettes saved in the composition, so that I can switch between different two-tone schemes.
25. As a designer, I want multiple full palettes saved in the composition, so that I can switch between different multi-color schemes.
26. As a designer, I want the active palette index to persist per mode, so that my selection is remembered when I switch modes and back.
27. As a designer, I want a single-color palette in Palette mode to apply that color to all rings, so that edge cases are handled gracefully.
28. As a designer, I want the Colors section to be collapsible in the sidebar, so that it doesn't take up space when I'm focused on geometry.
29. As a designer, I want new compositions to default to Monochrome mode with black main and white background, so that I start with a clean, high-contrast scheme.

## Implementation Decisions

### New: Color Mode Store
- A separate persistent store (lsSync) holds `{ mode: 'monochrome' | 'palette' | 'manual', palette: number }`.
- `palette` is the index of the active palette within the list for the current mode.
- This store is independent of the composition so mode preferences persist even when compositions change.

### Modified: Composition Type
- `Composition` gains two new fields:
  - `monochromePalettes`: array of `{ main: string; bg: string }` objects
  - `fullPalettes`: array of `{ colors: string[] }` objects
- `Ring.color` remains unchanged — it is still the field read by the renderer.
- Default `Composition` includes one monochrome palette `{ main: '#000000', bg: '#ffffff' }` and a set of full palettes (to be provided).

### New: Color Application Engine (pure module)
- A pure function that accepts: mode, active palette entry, ring count → returns `string[]` (one hex per ring, outermost-first).
- **Monochrome logic**: index `ringCount - 1` (outermost) = `main`, then alternate inward.
- **Palette logic**: random assignment, no two adjacent rings the same color, loop palette if shorter than ring count. If palette has 1 color, apply to all rings.
- **Manual logic**: returns existing `Ring.color` values unchanged (no-op).
- This module has no side effects and no Svelte dependencies — designed for isolated unit testing.

### Modified: Composition State Module
- New functions added:
  - `addMonochromePalette()`, `updateMonochromePalette(index, patch)`
  - `addFullPalette()`, `updateFullPalette(index, patch)`, `removeFullPalette(index)`, `removeMonochromePalette(index)`
  - `applyColorMode()` — calls the color application engine and writes results into each `Ring.color` via `updateRing()`
- `applyColorMode()` is called whenever mode changes, palette index changes, palette content changes, or reshuffle is triggered.
- It is also called when rings are added/removed (ring count change).

### New: Colors Section UI Component
- A collapsible section at the top of the sidebar, above ring editors.
- Contains a mode selector (dropdown or segmented control) for Monochrome / Palette / Manual.
- Renders MonochromePaletteEditor or FullPaletteEditor depending on mode. In Manual mode renders nothing extra.

### New: MonochromePaletteEditor Component
- Shows swatch rows for each monochrome palette (two color boxes: main + bg).
- Clicking a row selects it (updates palette index in color mode store).
- Active row has a selected state.
- Delete button per row, disabled when only one remains.
- "New palette" button appends a default `{ main: '#000000', bg: '#ffffff' }` entry.
- Selected palette shows two `<input type="color">` pickers labeled "Main" and "Background".

### New: FullPaletteEditor Component
- Shows swatch rows for each full palette (N color boxes).
- Clicking a row selects it.
- Delete button per row, disabled when only one remains.
- "New palette" button appends a default entry.
- Reshuffle button (only in Palette mode) triggers re-randomization.
- Selected palette shows an always-editable text input with comma-separated hex values.
- Below the input, a preview row of color boxes reflects the parsed palette in real time.

### Modified: RingEditor Component
- Per-ring color picker is conditionally rendered: visible only when `mode === 'manual'`.

### Hex Validation
- Valid hex: strings matching `/^#[0-9a-fA-F]{6}$/` (6-digit) or `/^#[0-9a-fA-F]{3}$/` (3-digit shorthand).
- Invalid entries are skipped during parsing.
- If parsing yields zero valid colors, fall back to `['#000000', '#ffffff']`.

## Testing Decisions

Good tests verify external behavior through the module's public interface — not implementation details like internal variable names or intermediate states.

### Color Application Engine
- This is the primary module to unit test.
- Test cases:
  - Monochrome with even ring count: verify outermost = main, strict alternation, correct innermost
  - Monochrome with odd ring count: same verification
  - Palette with more rings than colors: verify looping
  - Palette with 1 color: verify all rings receive that color
  - Palette mode: verify no two adjacent rings share the same color (run multiple times)
  - Manual mode: verify output equals input ring colors unchanged
- Prior art: geometry unit tests in the codebase (`vitest`)

### Hex Validation
- Test valid 6-digit hex, valid 3-digit hex, invalid strings, mixed valid/invalid arrays, all-invalid fallback.

## Out of Scope

- Alpha/transparency support in colors
- Gradient fills per ring
- Named palettes
- Importing/exporting palette libraries
- Color history or undo for palette edits
- HSL, RGB, or named CSS color input (hex only)
- Palette sharing between compositions

## Further Notes

- The `palette` index in the color mode store is shared across both mode's palette lists conceptually, but in practice it indexes into whichever list is active. Switching modes resets or preserves the index (behavior: preserve, may point out of bounds → clamp to 0).
- Default full palettes will be provided by the user before implementation begins.
- The reshuffle button only appears in Palette mode; it is not present in Monochrome or Manual modes.
