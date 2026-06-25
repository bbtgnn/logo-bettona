# `animation.svelte.ts` stays one module — the transport/morph/driver core is genuinely coupled

**Context.** `src/lib/state/animation.svelte.ts` is ~600 lines spanning roughly five concerns: the layer-kind config, the param registry + keyframe apply, the clock/transport (play-pause machine), the driver/audio-source wiring, and the morph + composition-sync bookkeeping. An architecture review ("candidate 07") flagged the length and proposed splitting it into ~5 focused modules. A dependency analysis was run before planning any split.

**Decision.** **Do not split the transport/morph/driver core.** It is one cohesive unit by necessity, and breaking it apart would create shallow modules that pass mutable state back and forth — worse than the current cohesive file. The file's length is not, on its own, a reason to split.

The analysis found only **two genuinely separable leaves**, and even those are optional sugar, not a fix for a problem:

- **Layer config** (`LAYER_KIND`, `DRIVER_LAYERS`, `GATE_LAYERS`, `isDriverLayer`) — ~20 lines, pure, no state.
- **Param registry + keyframe apply** (`AUDIO_*_PARAMS`, `getAllAnimatableParams`, `applyKeyframes`, `scrubTo`, `refreshPreview`, the config setters) — depends only on shared state, `keyframes`, `composition`, and the layer config; never calls the clock or the drivers.

Extracting those two would drop the file to ~450 lines but isolate only the cleanest concerns, leaving the coupled core untouched. Low risk, modest payoff — deferred unless a future change makes one of them grow.

## Considered options

- **Split into ~5 modules (rejected).** The clock (`tick`, `startNewAnimation`, `stopInternal`, `togglePlay`, `reconfigure…`) and the morph/composition-sync (`handleCompositionChanged`, `hasMorphTargets`) **share mutable bookkeeping** — `animatedIndices` and `lastRingCount` are written by both the transport path and `handleCompositionChanged`, and read by `applyMorphT` inside `stopInternal`. The driver `runtime` is likewise shared between `setLayerEnabled` and `tick`. `tick()` is the per-frame orchestrator: it drives motors, keyframes, and morph every frame, so it inherently reaches across all of them. Splitting these produces modules that re-export and re-import the same counters — the exact "shallow module" smell the split was meant to avoid.
- **Extract the two clean leaves only (deferred).** Possible and low-risk, but it doesn't address any real problem; it just shortens the file. Revisit only if `param-registry` or layer config grows or needs independent testing.
- **Leave as one module (chosen).** The driver logic itself already lives in separate modules (`animation-drivers/runtime`, `audio-source`, the per-driver factories); what remains in `animation.svelte.ts` is the wiring plus the coupled clock/morph core, which belongs together.

## Consequences

- A future architecture review will again see ~600 lines and may re-propose a split. **This ADR is the standing answer:** the dependency analysis showed the core is coupled through shared mutable bookkeeping (`animatedIndices`/`lastRingCount`) and the shared `runtime`; only two thin leaves are cleanly separable, and those are optional. Don't split for length alone.
- If a real driver for change appears (e.g. the param registry needs isolated tests, or a second transport consumer emerges), extract the relevant leaf then — not preemptively.
