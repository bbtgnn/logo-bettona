# Codebase Concerns

**Analysis Date:** 2026-04-26

## Tech Debt

**Render pipeline disposal:**

- Issue: `dispose` on the render pipeline is a no-op with a comment that lifecycle is deferred.
- Files: `src/lib/geometry/render-pipeline.ts`
- Impact: Long-lived sessions that create many pipeline instances could leak Paper.js resources; current `PreviewCanvas.svelte` creates one pipeline per component instance, which is acceptable but the API suggests disposal without delivering it.
- Fix approach: Implement scope teardown or document that callers must own scope lifetime; align `dispose` with actual cleanup.

**Stale TDD comment in morph unit tests:**

- Issue: `path-morph.svelte.spec.ts` opens with a comment claiming tests are an intentional red state for a not-yet-implemented module; the module exists and tests pass.
- Files: `src/lib/geometry/path-morph.svelte.spec.ts`
- Impact: Misleading maintainers about test intent and readiness.
- Fix approach: Remove or rewrite the comment to describe current behavior.

**Dual-path morph: unguarded `updateRing`:**

- Issue: `updateRing` merges arbitrary `Partial<Ring>` into persisted state without running `validatePathCompatibility`. Callers can set `templatePath` and `secondaryTemplatePath` to incompatible shapes in one or two steps, bypassing `updateRingPathVariant`.
- Files: `src/lib/state/composition.ts`, any future caller of `updateRing`
- Impact: LocalStorage or code paths can store inconsistent morph pairs; render falls back silently (see below) while state remains “invalid” until edited through validated APIs.
- Fix approach: Route all path mutations through `updateRingPathVariant`, or add an internal guard in `updateRing` when both paths are non-null, or normalize on load.

## Known Bugs

**Morph fallback warnings not surfaced in the main preview:**

- Symptoms: When morph paths are incompatible, `createRenderPipeline().render` pushes `Ring N morph fallback: …` into `result.warnings`, but `PreviewCanvas.svelte` ignores the return value entirely.
- Files: `src/lib/components/PreviewCanvas.svelte`, `src/lib/geometry/render-pipeline.ts`
- Trigger: Persist or construct a composition with matching presence of `templatePath` and `secondaryTemplatePath` but mismatched `cmds` or `crds` length (e.g. via `updateRing` or hand-edited localStorage).
- Workaround: Use unit tests or temporary logging to inspect `warnings`; fix state via Ring editor validated import or remove morph target.

**Silent no-op when `createRingMorphTarget` is called with a missing ring:**

- Issue: `createRingMorphTarget` returns early if `composition.rings[index]` is falsy or lacks `templatePath` without feedback.
- Files: `src/lib/state/composition.ts`
- Impact: Defensive but opaque for incorrect indices or empty primary paths.
- Fix approach: Return a result type or throw in debug-only paths; unlikely in UI-driven flows.

## Security Considerations

**Client-only composition integrity:**

- Risk: Tampered or imported JSON in `lsSync`-backed storage can set morph fields to inconsistent values.
- Files: `src/lib/state/composition.ts`, `src/lib/geometry/render-pipeline.ts`
- Current mitigation: Render-time `validatePathCompatibility` and primary-path fallback; per-ring try/catch continues drawing other rings.
- Recommendations: Treat as low severity (no server trust boundary). If compositions are ever shared or loaded from network, add a single normalization/validation pass on ingest.

## Performance Bottlenecks

**Full Paper.js redraw on every composition tick:**

- Problem: `PreviewCanvas.svelte` runs `renderPipeline.render` inside an `$effect` keyed on the whole `composition` object. Any ring field change clears the project and rebuilds all rings, including `validatePathCompatibility` and `interpolatePath` for each ring that has a secondary path.
- Files: `src/lib/components/PreviewCanvas.svelte`, `src/lib/geometry/render-pipeline.ts`, `src/lib/geometry/path-morph.ts`
- Cause: No incremental updates or memoization of interpolated paths.
- Improvement path: Debounce rapid slider input, memoize interpolated `Path` by `(primary, secondary, morphT)` hash, or split preview updates from full export pipeline.

**Per-ring Paper.js work in `buildRingPath`:**

- Problem: `bend.ts` builds temporary paths and segments per ring; cost grows with ring count and `copies`.
- Files: `src/lib/geometry/bend.ts` (~290 lines)
- Cause: inherent geometry cost, amplified when combined with full-scene rerenders above.
- Improvement path: Profile with realistic ring counts; consider lowering preview resolution or throttling morph slider.

## Fragile Areas

**Path morph compatibility is structural only:**

- Files: `src/lib/geometry/path-morph.ts`
- Why fragile: Compatibility is exact command sequence equality and coordinate count equality. Geometrically “similar” paths from `RingCanvas.svelte` or `svg-import.ts` can diverge in command choice (`L` vs `C`) while looking alike; users may not understand why morph fails or falls back.
- Safe modification: Extend `validatePathCompatibility` only with explicit tests in `path-morph.svelte.spec.ts`; keep render pipeline fallback behavior aligned with new rules.
- Test coverage: Command mismatch covered; coordinate-length mismatch reason exists in code but lacks a dedicated unit test assertion.

**Large interactive path editor:**

- Files: `src/lib/components/RingCanvas.svelte` (~412 lines)
- Why fragile: Couples Paper.js hit-testing, path serialization, and morph-unaware editing; regressions affect both primary and secondary variants fed from `RingEditor.svelte`.
- Safe modification: Prefer small, tested helpers; run `RingCanvas`-related specs after edits.
- Test coverage: Rely on integration via editor flows; no dedicated morph+editor matrix in unit tests.

**`clamp01` semantics differ between modules:**

- Files: `src/lib/geometry/path-morph.ts` (`Number.isNaN` → 0; non-finite positives can clamp high), `src/lib/state/composition.ts` (`Number.isFinite` → else 0 for state `morphT`)
- Why fragile: Divergent handling of `Infinity`/`NaN` between interpolation and persisted `morphT` can confuse debugging if bad values ever enter state.
- Safe modification: Share one `clamp01` utility or align semantics and add tests.

## Scaling Limits

**LocalStorage-backed composition size:**

- Current capacity: Entire `Composition` JSON in browser localStorage via `rune-sync`.
- Limit: Storage quota and JSON parse/stringify cost; large coordinate arrays from SVG import multiply size.
- Scaling path: Move composition to IndexedDB or server persistence; compress paths or use binary formats if needed.

## Dependencies at Risk

**Paper.js (`paper` ^0.12.18):**

- Risk: Large API surface used in `bend.ts`, `RingCanvas.svelte`, `render-pipeline.ts`, and SVG import; upgrades can change path bounds or segment behavior.
- Impact: Subtle morph or bend regressions without visual diff tests.
- Migration plan: Pin version until visual regression suite exists; upgrade in a branch with full `npm run test` and manual preview checks.

## Missing Critical Features

**No in-app surfacing of render warnings:**

- Problem: Operators cannot see `RenderResult.warnings` from the pipeline when morph falls back or a ring is skipped.
- Blocks: Transparent debugging of “why does my morph not blend?” without devtools.

**No automated test gate on deploy:**

- Problem: GitHub Actions workflow `.github/workflows/deploy.yml` runs `bun run build` only; it does not run `npm run test` or Playwright.
- Blocks: Confidence that morph regressions are caught before production deploys.

## Test Coverage Gaps

**`validatePathCompatibility` coordinate-length branch:**

- What's not tested: Explicit expectation for `Path coordinates must have the same length to interpolate` when `cmds` match but `crds.length` differs.
- Files: `src/lib/geometry/path-morph.ts`, `src/lib/geometry/path-morph.svelte.spec.ts`
- Risk: Refactor could drop the length check without failing tests.
- Priority: Medium

**Primary path update rejected when incompatible with existing secondary:**

- What's not tested: `updateRingPathVariant(index, 'primary', path)` when `ring.secondaryTemplatePath` is set and the new primary fails compatibility; code path exists in `composition.ts`.
- Files: `src/lib/state/composition.ts`, `src/lib/state/composition.svelte.spec.ts`
- Risk: Regression in primary-edit validation for morph rings.
- Priority: Medium

**End-to-end morph beyond create/remove:**

- What's not tested: Adjusting morph `t`, switching Primary/Secondary editors, SVG import rejection messages in live browser, or visual outcome of interpolation (Playwright only asserts “Morph t:” visibility).
- Files: `src/routes/demo/playwright/page.svelte.e2e.ts`, `src/lib/components/RingEditor.svelte`
- Risk: Slider or variant toggle regressions ship unnoticed.
- Priority: Medium

**Pipeline warning consumption in UI:**

- What's not tested: No component or integration test asserts that the app should display morph fallback warnings to users (currently no UI).
- Files: `src/lib/components/PreviewCanvas.svelte`
- Risk: If warnings are later added, behavior is undefined in tests.
- Priority: Low until product requires visible warnings.

---

*Concerns audit: 2026-04-26*
