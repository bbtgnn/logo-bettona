# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**Highly coupled interactive canvas editor:**
- Issue: `RingCanvas.svelte` combines path parsing, geometry transforms, drawing, and drag interaction handling in one large component, which makes behavior changes risky.
- Files: `src/lib/components/RingCanvas.svelte`
- Impact: Refactors and bugfixes in one interaction path can regress unrelated editing behavior.
- Fix approach: Split into focused modules (`path-conversion`, `interaction`, `rendering`) and keep `RingCanvas.svelte` as orchestration-only.

**Global mutable preprocessor pipeline for SVG import:**
- Issue: SVG preprocessors are stored in a module-level mutable array (`preprocessors`) without scoping to a specific editor/session.
- Files: `src/lib/geometry/svg-import.ts`
- Impact: Preprocessors can leak across consumers and tests if cleanup is missed, causing non-obvious import behavior changes.
- Fix approach: Replace global registry with explicit preprocessor injection per `importSvgFromString()` call.

## Known Bugs

**Drag state can remain stale when drag ends outside valid drop target:**
- Symptoms: Reordering can behave inconsistently after interrupted drag/drop because `dragFromIndex` only resets in drop handler.
- Files: `src/lib/components/Sidebar.svelte`
- Trigger: Start dragging a ring, then cancel/drop outside a valid drop zone.
- Workaround: Perform a successful drop interaction before the next drag attempt.

## Security Considerations

**Unbounded SVG input processing from local file uploads:**
- Risk: Arbitrarily large/complex SVGs are loaded into memory and parsed without explicit file size/complexity limits.
- Files: `src/lib/components/RingEditor.svelte`, `src/lib/geometry/svg-import.ts`
- Current mitigation: Invalid SVG parse is caught and returns `null`.
- Recommendations: Enforce max file size and path segment thresholds before calling `importSVG`.

## Performance Bottlenecks

**Full redraw on every reactive composition update:**
- Problem: The preview triggers `renderComposition()` and `fitToView()` for any composition change, and `renderComposition()` clears/rebuilds the full scene each time.
- Files: `src/lib/components/PreviewCanvas.svelte`, `src/lib/geometry/compose.ts`
- Cause: Coarse-grained reactive redraw strategy with no incremental update path.
- Improvement path: Track per-ring diffs and update only changed paths; debounce slider-driven updates.

**Heavy interaction redraw loop in ring editor:**
- Problem: Interactive edits rebuild visual controls and path state repeatedly through `draw()` and synchronization logic.
- Files: `src/lib/components/RingCanvas.svelte`
- Cause: Dense per-event computations and repeated object churn in mouse-drag handlers.
- Improvement path: Cache immutable geometry artifacts and isolate expensive recalculations to changed segments.

## Fragile Areas

**Index-keyed list rendering for reorderable ring editors:**
- Files: `src/lib/components/Sidebar.svelte`
- Why fragile: `{#each composition.rings as ring, i (i)}` uses index as key, which can mismatch component identity when items are reordered.
- Safe modification: Key by stable ring ID rather than index; add ID in `Ring` model and preserve across reorder.
- Test coverage: No component tests assert identity/state correctness after reorder operations.

**Ring geometry assumes valid non-zero copies without runtime guard:**
- Files: `src/lib/geometry/bend.ts`, `src/lib/types.ts`
- Why fragile: `buildRingPath()` computes `Math.PI / ring.copies`; invalid persisted data (`copies <= 0`) can generate invalid geometry math.
- Safe modification: Add runtime validation/clamping in state update and geometry entry points.
- Test coverage: Existing geometry tests focus on normal valid inputs only.

## Scaling Limits

**Ring/path complexity grows without constraints:**
- Current capacity: No enforced upper bounds for number of rings, `copies`, or imported path complexity.
- Limit: Rendering and editing performance degrade as generated segment count increases (`copies` * segments * mirrored arc expansion).
- Scaling path: Introduce guardrails (max rings, max copies, max path points) and preflight complexity checks on import.

## Dependencies at Risk

**Canvas/geometry dependency is a single critical point of failure:**
- Risk: Core render/import/edit workflows rely on `paper` API behavior.
- Impact: A breaking API/runtime issue in `paper` affects preview rendering, SVG import, and ring editing simultaneously.
- Migration plan: Create an adapter layer around geometry/render APIs to reduce direct dependency surface.

## Missing Critical Features

**No versioned migration for persisted local state:**
- Problem: LocalStorage-backed state keys (`composition`, `color-mode`, `composition-ui`) have no schema versioning/migration path.
- Blocks: Safe evolution of persisted `Composition`/palette shape without risking invalid legacy state.

## Test Coverage Gaps

**UI interaction flows are largely untested:**
- What's not tested: Drag-and-drop ring reorder, ring editor input interactions, canvas editing interactions, and export behavior.
- Files: `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`, `src/lib/components/RingCanvas.svelte`, `src/lib/components/PreviewCanvas.svelte`
- Risk: Regressions in core editor UX can ship undetected.
- Priority: High

**E2E coverage is demo-only and does not exercise primary editor flow:**
- What's not tested: Main route/editor journey on `src/routes/+page.svelte`.
- Files: `src/routes/demo/playwright/page.svelte.e2e.ts`, `src/routes/+page.svelte`
- Risk: End-to-end failures in production path are not caught by CI.
- Priority: High

---

*Concerns audit: 2026-04-24*
