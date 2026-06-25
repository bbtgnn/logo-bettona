# No separate RenderInputValidator — validation belongs in the pipeline, `asserts` narrowing must stay

**Context.** An architecture review ("candidate #6") flagged the ~30 lines of input validation inside `createRenderPipeline` (`render-pipeline.ts`: `assertScope`, `assertViewport`, `assertComposition`) as buried, untested in isolation, and throwing cryptic strings. It proposed a `RenderInputValidator` module exposing `validateRenderInput(input): ValidationResult` (returning errors rather than throwing) so callers get early feedback, and optionally typing the scope as a dedicated interface. A code reading was done before planning.

**Decision.** **Do not extract a RenderInputValidator.** Every premise is already addressed, and a Result-returning validator would be a regression.

The reading found:

- **The validation is already tested through the interface.** `render-pipeline.svelte.spec.ts` covers invalid viewport, missing scope, invalid scope contract, invalid composition contract, and wrapping of unexpected runtime scope failures. The interface is the test surface, and these tests cross it — the assertions are not untested.
- **The errors are already clear.** They throw `RenderPipelineError` with explicit messages ("Viewport width and height must be greater than zero", "Render input scope is missing or invalid", "Render input composition is missing or invalid"), and `toPipelineError` wraps unexpected failures with context. Nothing cryptic.
- **The assertions use `asserts` type guards.** `assertScope(scope): asserts scope is paper.PaperScope` (and the composition twin) both validate at runtime and narrow the type for the rest of `renderOnce`. This is the right idiom for a precondition that is also a type refinement.

## Considered options

- **RenderInputValidator returning a ValidationResult (rejected).** The pipeline cannot proceed on invalid input, so it would have to throw on a bad result anyway — and a Result-returning function does not narrow types, so `renderOnce` would lose the `asserts` narrowing and need manual casts on `scope`/`composition`. Deletion test: extracting moves the same checks out and makes the call site worse. Complexity relocates and degrades.
- **Type the scope as a dedicated `RenderPipelineScope extends paper.PaperScope` interface (rejected).** The scope is already typed `paper.PaperScope`; the runtime asserts exist precisely because callers (tests, uninitialized paper) can pass malformed objects that satisfy the static type. A narrower interface does not remove the need for the runtime guard.
- **Leave validation in the pipeline (chosen).** It is the pipeline's own precondition, co-located with use, tested through the interface, clear in its errors, and narrows types via `asserts`.

## Consequences

- A future architecture review will again see ~30 lines of assertions inside `createRenderPipeline` and may re-propose extracting a validator for isolated testing. **This ADR is the standing answer:** the assertions are already tested through the interface, already throw clear `RenderPipelineError`s, and use `asserts` to narrow types — a Result-returning validator would lose that narrowing and worsen the call site.
- If a second caller ever needs to validate render input *without* rendering (e.g. a form pre-check), extract a shared `asserts`-style guard then — keeping the type narrowing, not a Result.
