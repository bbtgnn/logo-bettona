# Codebase Concerns

**Analysis Date:** 2026-07-06

## Tech Debt

**Driver ↔ audio-source lifecycle is an implicit global contract:**

- Issue: `setLayerEnabled`/`syncActiveDrivers` in `src/lib/state/animation.svelte.ts` classify layers via `LayerKind` (`driver`/`gate`/`inert`) and special-case them across three functions. "Turn off the last driver layer → tear down the live `audioSource`" is an implicit rule spread over `DRIVER_LAYERS`, `syncActiveDrivers`, and the teardown branch.
- Files: `src/lib/state/animation.svelte.ts`, `src/lib/state/animation-drivers/runtime.ts`, `src/lib/state/animation-drivers/audio-source.ts`
- Impact: adding a fourth layer, or a non-audio driver, means touching every special-case site; easy to leave the audio graph alive or double-dispose.
- Fix approach: make each layer declare its kind + lifecycle hooks in one table the runtime consumes, so "last driver off" falls out of the data rather than a hand-written branch.
- Priority: Medium.

**`updateRingPathVariant` primary-reseed is a labelled stopgap:**

- Issue: a structurally incompatible **primary** path edit silently re-seeds the secondary from the new primary instead of rejecting, to keep the morph pair interpolatable. The code comments it as a stopgap pending relocation of morph editing to Animate.
- Files: `src/lib/state/composition.ts` (the `variant === 'primary'` branch)
- Impact: an edit can quietly discard a user's authored secondary path; the behavior is inconsistent with the secondary branch (which rejects). Stale JSDoc risk (the doc once said "rejects").
- Fix approach: land the Animate morph-editing move (spec "Animate #2") and drop the re-seed.
- Priority: Medium.

**Render-pipeline `dispose()` is still a no-op:**

- Issue: `dispose()` returns without releasing any Paper.js resources — the comment marks disposal lifecycle as "intentionally deferred".
- Files: `src/lib/geometry/render-pipeline.ts:246-248`, callers in `src/lib/components/preview-presenter.svelte.ts`
- Impact: the presenter mounts multiple `PaperScope`s (visible + offscreen tile + transient export scopes); with the kaleidoscope rAF loop driving frequent churn, cleanup semantics stay ambiguous over long sessions.
- Fix approach: implement real scope teardown, or rename/document `dispose()` as intentionally inert so callers do not assume cleanup.
- Priority: Low.

**Package identity and tool story are inconsistent:**

- Issue: `package.json` `name` is `test-logo-2`; its scripts and `playwright.config.ts` invoke `npm run …`, while the declared/actual package manager is bun (`bun.lock`, CLAUDE.md, and CI's `bun i && bun run build`).
- Files: `package.json`, `playwright.config.ts`, `.github/workflows/deploy.yml`, `bun.lock`
- Impact: a contributor following the docs (bun) hits `npm`-worded scripts; the placeholder name leaks into any published metadata.
- Fix approach: rename the package and normalize scripts to one runner (or document that scripts are runner-agnostic and bun is canonical).
- Priority: Low.

## Known Bugs

**Render warnings are still dropped by the preview UI:**

- Symptoms: `createRenderPipeline().render()` returns `RenderResult.warnings` (morph fallback, skipped rings), but neither the presenter nor any UI surfaces them.
- Files: `src/lib/components/preview-presenter.svelte.ts`, `src/lib/geometry/render-pipeline.ts`
- Trigger: incompatible primary/secondary paths or per-ring render failures during live playback.
- Workaround: inspect warnings via tests/dev instrumentation; no in-app visibility.

## Security Considerations

**Client-controlled composition and animation state:**

- Risk: `localStorage` composition/path-library/color data is user-tamperable; malformed morph/path values get applied to targeted rings each tick.
- Files: `src/lib/state/composition-persistence.svelte.ts`, `src/lib/state/composition.ts`, `src/lib/geometry/render-pipeline.ts`
- Current mitigation: the render pipeline validates path compatibility and skips/falls back; `setRingMorphT` and the driver runtime `clamp01` animated writes; the persisted store strips transient fields on write.
- Recommendation: add a single normalization pass at the load boundary if storage/import trust ever broadens beyond local single-user use.

## Performance Bottlenecks

**Kaleidoscope rAF loop + per-frame full-scene render:**

- Problem: while `kaleidoscope.enabled`, a `requestAnimationFrame` loop redraws every frame; `liveTile` re-renders the offscreen composition tile each frame. Outside kaleidoscope, each driver/keyframe tick writes ring state and re-runs the whole `render-pipeline` over the composition.
- Files: `src/lib/components/preview-presenter.svelte.ts`, `src/lib/state/animation.svelte.ts`, `src/lib/geometry/render-pipeline.ts`
- Cause: no incremental render path; no frame-throttled batching of morph/param writes.
- Improvement path: batch writes per frame, throttle to rAF cadence, cache the static tile aggressively (already done for non-`liveTile`), and profile hot paths at realistic ring/copy counts.

**Per-frame interpolation + bend/wave/zone work scales with ring count:**

- Problem: playback can run compatibility checks, `interpolatePath`, `buildRingPath`, and wave/zone deformation for many rings every frame.
- Files: `src/lib/geometry/path-morph.ts`, `src/lib/geometry/bend.ts`, `src/lib/geometry/wave.ts`, `src/lib/geometry/zones.ts`, `src/lib/geometry/render-pipeline.ts`
- Improvement path: memoize interpolated snapshots per `t` bucket in preview mode; benchmark with realistic compositions.

## Fragile Areas

**Single-writer canvas arbitration is correctness-critical but convention-enforced:**

- Files: `src/lib/components/preview-presenter.svelte.ts`
- Why fragile: exactly one writer of the visible `<canvas>` is guaranteed only by the flat-composition `$effect` returning early on `kaleidoscope.enabled` and yielding to the rAF loop. A future effect that writes the canvas without honoring that gate reintroduces two-writer flicker. The rAF loop also must NOT depend on live-read params (sectors/repeat) or it tears down every frame — an easy regression.
- Safe modification: keep all visible-canvas writes behind the `enabled` gate; when adding params read live inside `drawKaleidoscope`, do not add them as effect dependencies.
- Test coverage: `preview-presenter.svelte.spec.ts` asserts the early-return/sole-writer contract; extend it when adding writers.

**Keyframe gate coupling:**

- Files: `src/lib/state/animation.svelte.ts` (`applyKeyframes`)
- Why fragile: params scoped to a gate layer (`<layer>.*`) are skipped unless that layer flag is on; the coupling lives in string-prefix matching. Renaming a layer or param id silently disables its keyframes.
- Safe modification: change gate names and param-id prefixes together; cover with a keyframe-gate test.

## Scaling Limits

**High-frequency animation writes vs persisted composition:**

- Current capacity: composition persists through a `rune-sync`-backed store that strips transient fields before each write.
- Limit: even with stripping, per-frame ring-array replacement (`.map(...)`) creates reactive pressure that grows with ring count and simultaneous animated layers.
- Scaling path: keep transient animation state fully out of the persisted object and/or lower persistence cadence further.

## Dependencies at Risk

**`animejs` is a declared-but-unused runtime dependency (dead dep):**

- Risk: `animejs` (`^4.3.6`) sits in `package.json` `dependencies` but is imported nowhere in `src/` (`grep -rn animejs src/` is empty). Playback is fully in-house (`createAnimationRuntime` + a `requestAnimationFrame` loop). A dead runtime dep ships weight, invites confusion ("which engine drives playback?"), and masks the real answer.
- Files: `package.json`, `src/lib/state/animation.svelte.ts`, `src/lib/state/animation-drivers/runtime.ts`
- Fix approach: remove `animejs` from `dependencies` (nothing imports it), or — if it is intended for future use — leave a note and a tracking task. Do not describe it as the playback engine.
- Priority: Low.

**Paper.js render-cost sensitivity:**

- Risk: Paper.js hotspots now run every playback/kaleidoscope frame, not only on edits.
- Files: `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/kaleidoscope.ts`, `src/lib/components/preview-presenter.svelte.ts`
- Migration plan: keep `paper` pinned until a frame-budget benchmark exists.

## Missing Critical Features

**No dedicated static export module:**

- Problem: static SVG/PNG download lives inline in `preview-presenter` (`exportSvg`/`exportPng`); there is no standalone `export/` module for it, unlike the WebM video path (`export/canvas-export.ts`). A future static-export path is unbuilt and must stay distinct from the video path (see ARCHITECTURE, decision 3).
- Blocks: reusing/​testing static export independently of the live presenter.

**Kaleidoscope parameter keyframe authoring was dropped:**

- Problem: authoring UI for kaleidoscope-parameter keyframes (rotation/sectors over the timeline) was removed in PR #13; previously-authored keyframes still play back (pipeline untouched), but there is no authoring surface. To be re-homed in a future Animate pass.
- Blocks: animating kaleidoscope parameters over the timeline.

**No user-visible render/error channel during playback:**

- Problem: users cannot see when animation falls back due to morph incompatibility or ring render failure (warnings dropped, above).
- Blocks: self-service debugging of animation correctness.

## Test Coverage Gaps

**CI does not gate on tests:**

- What's not tested at deploy: `.github/workflows/deploy.yml` runs `bun run build` only — no `test:unit`/`test:e2e` gate.
- Files: `.github/workflows/deploy.yml`, `package.json`
- Risk: controller/render regressions can reach the deployed Pages site undetected.
- Priority: Medium.

**Preview-presenter arbitration under real render load:**

- What's not tested: sustained kaleidoscope rAF playback + composition edits driving repeated re-snapshots and re-renders end to end.
- Files: `src/lib/components/preview-presenter.svelte.spec.ts`, `src/lib/components/preview-presenter.export.svelte.spec.ts`
- Risk: two-writer flicker or tile-lifecycle regressions can ship without detection.
- Priority: Medium.

**Full e2e suite is not routinely run:**

- What's not tested: only nav-scoped e2e (`workspace-nav`, `about-nav`, `path-manager`) is exercised in typical change sets; there is no broad interaction e2e for the four-section pipeline.
- Files: `src/routes/**/**.e2e.ts`
- Priority: Low.

---

*Concerns audit: 2026-07-06*
</content>
