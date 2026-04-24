# Render Pipeline Deep Module Design

Date: 2026-04-24  
Project: `logo-bettona`  
Focus: Deepen rendering architecture by separating orchestration from geometry generation and UI lifecycle wiring.

## 1) Goal and Context

The current rendering flow mixes three concerns:

- UI lifecycle and redraw triggering in `PreviewCanvas`
- Orchestration policy (draw order, fit strategy, scope updates)
- Geometry generation and paper.js scene mutation

This creates shallow module boundaries where callers need to know too much about orchestration details. The objective is to introduce a deep module that exposes a small interface while hiding render complexity.

Primary outcome target: cleaner separation of responsibilities (maintainability).

## 2) Recommended Approach

Chosen approach: **RenderPipeline service boundary**.

This is the best fit for current constraints because it:

- creates a single, stable boundary for rendering behavior
- reduces coupling between `PreviewCanvas` and geometry internals
- allows iterative migration with behavior parity
- preserves a path to future evolution toward a more explicit render-plan architecture if needed

## 3) Architecture

Introduce a deep module in `src/lib/geometry`:

- `RenderPipeline` (public boundary)

Responsibilities by layer:

- **`PreviewCanvas`**
  - manages mount/unmount and redraw triggers
  - passes rendering input to pipeline
  - does not own orchestration policy
- **`RenderPipeline`**
  - validates input
  - decides orchestration order
  - clears scene, executes render passes, applies fit policy
  - centralizes paper.js side effects
- **Geometry primitives (`bend`)**
  - produce path/shape data only
  - no draw-order/lifecycle policy
- **Legacy compose helpers**
  - absorbed or reduced to private pipeline helpers

## 4) Public Interface

Public API should remain small:

- `createRenderPipeline(config?)`
- `pipeline.render(input)`
- `pipeline.dispose()`

Proposed input shape:

- `composition`
- `paperScope` (or active project handle)
- `viewport` (`width`, `height`, optional padding)
- optional `renderOptions` (fit strategy, debug flags)

Proposed output shape:

- `RenderResult` with:
  - counts (units rendered/skipped)
  - timing metadata (coarse)
  - warnings list

Internal (non-exported) collaborators:

- `SceneBuilder`
- `GeometryBuilder`
- `PaperRenderer`
- `ViewFitter`

These collaborators can begin as internal functions and split into files only when justified by complexity.

## 5) Data Flow

Per render call:

1. Validate render input contract.
2. Build ordered scene units from composition.
3. Generate geometry for each unit.
4. Apply render pass sequence to paper.js.
5. Apply fit strategy.
6. Return `RenderResult`.

Deterministic ordering is a hard requirement to keep output stable and testable.

## 6) Error Handling

Error policy by category:

- **Recoverable unit issues** (for example malformed ring path):
  - skip affected unit
  - append warning to `RenderResult`
  - continue rendering remaining units
- **Contract violations** (missing scope, invalid viewport):
  - throw typed `RenderPipelineError`
- **Unexpected paper.js failures**:
  - wrap and rethrow with contextual metadata (ring index, pass name)

This policy keeps faults diagnosable without leaking internals to callers.

## 7) Testing Strategy

Shift tests from orchestration internals toward boundary behavior.

Add pipeline boundary tests for:

- deterministic draw order invariants
- fit behavior invariants
- warning collection on partial failures
- typed failure behavior on contract errors

Retain focused geometry tests for `bend` shape correctness, but remove tests that only assert orchestration step mechanics.

Add one integration test for `PreviewCanvas` verifying delegation to pipeline, not internal orchestration details.

## 8) Migration Plan

1. Introduce `RenderPipeline` with behavior parity behind existing flow.
2. Switch `PreviewCanvas` to invoke `pipeline.render`.
3. Move orchestration logic from existing compose/render entrypoints into pipeline internals.
4. Remove obsolete helpers and rewrite affected tests toward boundary coverage.
5. Optionally split internal collaborators into separate files after parity is confirmed.

## 9) Non-Goals

- No UI feature changes.
- No new rendering feature set.
- No immediate renderer abstraction for multiple backends.

## 10) Risks and Mitigations

- **Risk:** hidden behavior drift during orchestration relocation  
  **Mitigation:** parity checks and incremental migration, boundary tests before pruning old helpers.

- **Risk:** over-fragmenting pipeline internals too early  
  **Mitigation:** keep internal collaborators private and split only when complexity justifies.

- **Risk:** unclear ownership between UI and pipeline  
  **Mitigation:** enforce rule that UI triggers render, pipeline owns render policy.

## 11) Success Criteria

- `PreviewCanvas` no longer contains orchestration policy.
- One clear rendering boundary (`pipeline.render`) is used by callers.
- Tests emphasize boundary outcomes over internal render sequencing.
- Rendering behavior remains functionally equivalent after migration.
