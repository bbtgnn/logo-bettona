# Codebase Concerns

**Analysis Date:** 2026-04-27

## Tech Debt

**Render pipeline disposal remains a no-op:**

- Issue: `dispose()` still does not release Paper.js resources and the comment explicitly defers lifecycle ownership.
- Files: `src/lib/geometry/render-pipeline.ts`, `src/lib/components/PreviewCanvas.svelte`
- Impact: Animation now drives frequent render churn; if multiple preview scopes are mounted/unmounted over long sessions, cleanup semantics stay ambiguous and hard to reason about.
- Fix approach: Either implement real scope teardown in `dispose()` or rename/document it as intentionally inert so callers do not assume cleanup occurs.

**Animation controller duplicates clamping/domain logic:**

- Issue: `clamp01` exists in both animation and composition state layers with independent ownership.
- Files: `src/lib/state/animation.svelte.ts`, `src/lib/state/composition.ts`, `src/lib/geometry/path-morph.ts`
- Impact: Maintainability risk when morph bounds behavior changes; subtle differences can produce drift between persisted and animated values.
- Fix approach: Centralize clamp semantics in one shared utility and cover Infinity/NaN behavior in a single test matrix.

**Controller restart path increases behavioral complexity:**

- Issue: `reconfigureCurrentAnimation()` recreates anime instances and then conditionally re-toggles play/pause state.
- Files: `src/lib/state/animation.svelte.ts`
- Impact: Harder to modify safely; future edits to toggle semantics can break paused-state preservation or introduce regressions in loop/alternate mode.
- Fix approach: Split pause/play state transitions into explicit controller methods and test each transition as a state machine table.

## Known Bugs

**Render warnings are still dropped by preview UI:**

- Symptoms: `renderPipeline.render()` returns warnings, including morph fallback and skipped-ring diagnostics, but preview rendering ignores the return payload.
- Files: `src/lib/components/PreviewCanvas.svelte`, `src/lib/geometry/render-pipeline.ts`
- Trigger: Incompatible primary/secondary paths or per-ring render failures during live animation/playback.
- Workaround: Inspect warnings via tests/dev instrumentation; no in-app visibility for users.

## Security Considerations

**Client-controlled animation and morph state integrity:**

- Risk: Local `lsSync` composition data can be tampered with to inject malformed morph/path values; animation will apply those values to all targeted rings each tick.
- Files: `src/lib/state/composition.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/geometry/render-pipeline.ts`
- Current mitigation: Render pipeline validates path compatibility and skips/falls back on failures; `setRingMorphT()` clamps animated writes.
- Recommendations: Add one normalization pass at composition load boundaries if storage/import trust broadens beyond local single-user usage.

## Performance Bottlenecks

**Animation tick forces full-scene redraw:**

- Problem: Controller `onUpdate` calls `setRingMorphT()` for every morph-capable ring, and `PreviewCanvas.svelte` reacts by re-running full `renderPipeline.render()` over the whole composition.
- Files: `src/lib/state/animation.svelte.ts`, `src/lib/state/composition.ts`, `src/lib/components/PreviewCanvas.svelte`, `src/lib/geometry/render-pipeline.ts`
- Cause: No incremental rendering path and no frame-throttled write batching for morph updates.
- Improvement path: Batch morph writes per frame, throttle UI updates to rAF cadence, and/or introduce partial redraw strategies for unchanged rings.

**Per-frame interpolation + bend work scales with ring count:**

- Problem: During playback, each render can hit compatibility checks, interpolation, and `buildRingPath()` geometry creation for many rings.
- Files: `src/lib/geometry/path-morph.ts`, `src/lib/geometry/bend.ts`, `src/lib/geometry/render-pipeline.ts`
- Cause: Computationally heavy geometry pipeline repeated on every animation frame.
- Improvement path: Memoize interpolated path snapshots for repeated `t` buckets in preview mode and profile hot paths with realistic ring/copies counts.

## Fragile Areas

**Animation lifecycle ownership is UI-coupled but implicit:**

- Files: `src/lib/components/AnimationSection.svelte`, `src/lib/state/animation.svelte.ts`
- Why fragile: Composition-change safety is triggered by `AnimationSection` mount effect; if section placement/visibility changes, runtime safeguards may stop running while controller state remains module-global.
- Safe modification: Keep composition-change guard in a top-level always-mounted runtime module or document that animation safety depends on sidebar section mount.
- Test coverage: `AnimationSection.svelte.spec.ts` checks one render-time call only; it does not assert behavior under conditional mounting/unmounting.

**Path compatibility remains structurally strict:**

- Files: `src/lib/geometry/path-morph.ts`, `src/lib/state/composition.ts`
- Why fragile: Controller amplifies this by continuously reusing morph targets; seemingly similar user-edited paths can still fail and fall back.
- Safe modification: Adjust compatibility rules only with matching updates to composition validators and render fallback tests.
- Test coverage: Core mismatches are covered, but warning-surface behavior in UI remains untested.

## Scaling Limits

**Animation write frequency vs local persistence model:**

- Current capacity: Entire composition is persisted via `rune-sync` localStorage state.
- Limit: High-frequency morph updates can increase serialization/reactivity pressure as ring count grows, especially when multiple rings animate simultaneously.
- Scaling path: Decouple transient animation state from persisted composition or persist morph snapshots at lower cadence.

## Dependencies at Risk

**Anime.js API coupling through hand-rolled instance typing:**

- Risk: Controller defines a custom `AnimeInstance` shape (`play/pause/cancel/revert`) rather than importing stable library types.
- Files: `src/lib/state/animation.svelte.ts`, `package.json`
- Impact: Runtime breakage risk on anime.js upgrades (`animejs` `^4.3.6`) if methods/semantics shift while TypeScript still compiles.
- Migration plan: Type against official anime.js exports where possible and pin/upgrade with focused controller regression tests.

**Paper.js render cost sensitivity increased by animation:**

- Risk: Existing Paper.js rendering hotspots now run on every playback frame rather than only on explicit edit interactions.
- Files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/bend.ts`, `src/lib/components/PreviewCanvas.svelte`
- Impact: FPS degradation on larger compositions becomes more likely.
- Migration plan: Keep `paper` pinned until frame-budget benchmarks and preview performance tests exist.

## Missing Critical Features

**No runtime performance guardrails for playback:**

- Problem: Playback has no adaptive quality/fps controls, ring-count guardrails, or auto-throttle when frame cost spikes.
- Blocks: Predictable responsiveness on low-end devices and large compositions.

**No user-visible fallback/error channel during animation:**

- Problem: Users cannot see when animation is falling back due to morph incompatibility or ring render failures.
- Blocks: Self-service debugging of animation correctness in the UI.

## Test Coverage Gaps

**Animation + preview integration under real render load:**

- What's not tested: End-to-end playback where `togglePlay()` drives `setRingMorphT()` and triggers `PreviewCanvas` pipeline redraw repeatedly.
- Files: `src/lib/state/animation.svelte.spec.ts`, `src/lib/components/PreviewCanvas.svelte.spec.ts`
- Risk: Regressions in frame updates or render throughput can ship without detection.
- Priority: High

**Animation safety behavior under UI lifecycle changes:**

- What's not tested: Unmount/remount of `AnimationSection.svelte` while animation is active and whether composition safety checks remain enforced.
- Files: `src/lib/components/AnimationSection.svelte`, `src/lib/components/AnimationSection.svelte.spec.ts`, `src/lib/state/animation.svelte.ts`
- Risk: Orphaned animation runtime state in future layout refactors.
- Priority: Medium

**Deploy pipeline still skips automated tests:**

- What's not tested: CI deploy path does not gate on `test:unit` or `test:e2e`.
- Files: `.github/workflows/deploy.yml`, `package.json`
- Risk: Animation/controller regressions can reach deployment undetected.
- Priority: Medium

---

*Concerns audit: 2026-04-27*
