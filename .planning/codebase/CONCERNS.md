# Codebase Concerns

**Analysis Date:** 2026-04-24

## Tech Debt

**Client state and domain logic are tightly coupled:**
- Issue: UI-facing storage state, palette application, ring list mutations, and reordering all live in one mutable module.
- Files: `src/lib/state/composition.ts`, `src/lib/components/Sidebar.svelte`, `src/lib/components/ColorsSection.svelte`
- Impact: behavioral changes are harder to isolate, and regressions in one concern can affect unrelated editor behavior.
- Fix approach: split `src/lib/state/composition.ts` into focused modules (`palette-state`, `ring-state`, `ui-state`) and keep orchestration in a thin facade API.

**Geometry serialization logic duplicated across modules:**
- Issue: path command/coordinate conversions and path construction are repeated in multiple places.
- Files: `src/lib/geometry/svg-import.ts`, `src/lib/components/RingCanvas.svelte`, `src/lib/geometry/bend.ts`
- Impact: subtle drift between conversion rules can produce non-equivalent geometry behavior and harder debugging.
- Fix approach: extract a shared geometry codec utility in `src/lib/geometry/` and reuse it from import, editor, and bend/render code.

**Pipeline lifecycle intentionally deferred:**
- Issue: render pipeline exposes `dispose()` but it is currently a no-op with explicit defer comment.
- Files: `src/lib/geometry/render-pipeline.ts`, `src/lib/components/PreviewCanvas.svelte`
- Impact: future resources (subscriptions, caches, pooled objects) can leak if cleanup remains unimplemented.
- Fix approach: define disposal contract now (clear retained references, unregister listeners) and test with a lifecycle spec.

## Known Bugs

**Collapsed/expanded ring UI can drift after reorder/remove:**
- Symptoms: ring panel open state can appear on the wrong ring after drag/drop reorder or ring deletion.
- Files: `src/lib/state/composition.ts`, `src/lib/components/Sidebar.svelte`, `src/lib/components/RingEditor.svelte`
- Trigger: reorder in `Sidebar.svelte` is index-based, while expanded state is stored as `expandedRings[index]`.
- Workaround: manually re-open/close affected ring panels after reorder.

**Duplicate palette colors can cause unstable keyed rendering:**
- Symptoms: color swatches may remount or behave unexpectedly when duplicate color values exist in a palette.
- Files: `src/lib/components/FullPaletteEditor.svelte`
- Trigger: swatches are keyed by color value (`{#each active.colors as color (color)}`), which is non-unique for repeated colors.
- Workaround: use unique colors in palette entries.

## Security Considerations

**Unbounded SVG import from user input:**
- Risk: very large or complex SVGs can cause client-side CPU/memory exhaustion during import and transform.
- Files: `src/lib/components/RingEditor.svelte`, `src/lib/geometry/svg-import.ts`
- Current mitigation: malformed/unsupported SVGs return `null`; compound paths are rejected.
- Recommendations: enforce file size and path complexity limits before `importSVG`, and surface explicit validation errors.

**No centralized trust boundary for imported path data:**
- Risk: imported path coordinates can include extreme values that stress rendering math and generate pathological bounds.
- Files: `src/lib/geometry/svg-import.ts`, `src/lib/geometry/bend.ts`, `src/lib/geometry/render-pipeline.ts`
- Current mitigation: render pipeline catches per-ring failures and continues.
- Recommendations: add coordinate/ring parameter normalization and hard clamps in a single validation layer.

## Performance Bottlenecks

**High-frequency full redraw during interactive editing:**
- Problem: every drag event in the ring editor rebuilds geometry and updates view synchronously.
- Files: `src/lib/components/RingCanvas.svelte`
- Cause: `onMouseDrag` handlers recompute and emit full path updates on every pointer delta.
- Improvement path: batch updates with `requestAnimationFrame`, debounce model sync, and avoid full scene rebuild when only handle visuals move.

**Ring rendering scales with ring count and copy count:**
- Problem: render cost grows quickly as copies increase because segments are rebuilt and tiled every render.
- Files: `src/lib/geometry/bend.ts`, `src/lib/geometry/render-pipeline.ts`, `src/lib/components/PreviewCanvas.svelte`
- Cause: per-render recomputation of transformed segments for every ring and copy.
- Improvement path: memoize transformed templates by `(templatePath, ringHeight, copies)` and only recompute changed rings.

## Fragile Areas

**Large, interaction-dense editor component:**
- Files: `src/lib/components/RingCanvas.svelte`
- Why fragile: path conversion, drawing, drag behavior, smoothing logic, and UI synchronization are all in one ~400-line file.
- Safe modification: isolate pure helpers (`buildPaperPath`, `paperPathToPath`, smoothing transforms) into `src/lib/geometry/` and add focused unit tests before behavior edits.
- Test coverage: no dedicated tests for `RingCanvas.svelte`.

**Complex path transformation algorithm with many geometric assumptions:**
- Files: `src/lib/geometry/bend.ts`
- Why fragile: algorithm combines bbox normalization, polar mapping, handle transformation, mirroring, and tiling in one code path.
- Safe modification: preserve behavior with golden tests for representative templates before changing transformation math.
- Test coverage: `src/lib/geometry/bend.svelte.spec.ts` exists, but it does not fully protect all degenerate/edge geometry inputs.

## Scaling Limits

**Canvas rendering throughput is client-bound:**
- Current capacity: suitable for small-to-moderate ring counts and copy counts on desktop-class browsers.
- Limit: interaction smoothness degrades as `composition.rings.length` and per-ring `copies` grow.
- Scaling path: reduce per-frame work (memoization + rAF scheduling), and consider worker/off-main-thread geometry preprocessing.

**State persistence is local-storage only:**
- Current capacity: single-browser, single-device persistence via `rune-sync/localstorage`.
- Limit: no conflict resolution, collaboration, or large payload strategy.
- Scaling path: introduce versioned persisted schema and optional remote persistence boundary.

## Dependencies at Risk

**Framework and package manager mismatch in automation path:**
- Risk: repository has `bun.lock` and deploy uses Bun, while local scripts and docs primarily use npm.
- Impact: drift between local/dev and CI behavior, harder reproducibility when lockfile/tooling assumptions differ.
- Migration plan: standardize on one package manager in `README.md`, scripts, and workflow (`.github/workflows/deploy.yml`).

## Missing Critical Features

**Production-grade error reporting for render/import failures:**
- Problem: render/import failures are surfaced as local warnings/null returns with no structured user feedback pipeline.
- Blocks: reliable debugging in production and issue triage from non-technical users.

**Meaningful end-to-end regression coverage for the main editor flow:**
- Problem: only a minimal heading visibility e2e exists.
- Blocks: confident refactors to editor interactions, drag/drop behavior, and import/export flows.

## Test Coverage Gaps

**Ring editor interaction behavior is untested:**
- What's not tested: anchor drag, handle drag, smooth-handle mirroring, clamp behavior, and event-to-model synchronization.
- Files: `src/lib/components/RingCanvas.svelte`, `src/lib/components/RingEditor.svelte`
- Risk: regressions in interactive editing can ship unnoticed.
- Priority: High

**State management edge cases around reorder/palette indexing:**
- What's not tested: reorder + expanded-state consistency, index bounds for palette selection over list mutation.
- Files: `src/lib/state/composition.ts`, `src/lib/components/Sidebar.svelte`, `src/lib/components/MonochromePaletteEditor.svelte`, `src/lib/components/FullPaletteEditor.svelte`
- Risk: subtle UI inconsistency and incorrect state transitions.
- Priority: High

**E2E coverage is smoke-level only:**
- What's not tested: SVG import, ring editing, ring reorder, palette switching, and SVG export workflows.
- Files: `src/routes/demo/playwright/page.svelte.e2e.ts`, `src/routes/+page.svelte`
- Risk: major user journeys can break while tests still pass.
- Priority: High

---

*Concerns audit: 2026-04-24*
