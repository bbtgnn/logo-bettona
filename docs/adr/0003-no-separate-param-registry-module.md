# No separate ParamRegistry module — construction is already centralized, the per-frame rebuild is deliberate

**Context.** An architecture review ("candidate #3") proposed extracting a **ParamRegistry** module that would own the construction of every `AnimatableParam` and the `getAllAnimatableParams()` orchestration, memoizing static registries and recomputing per-ring params only on ring change. The stated friction: registries are scattered, and `applyKeyframes()` rebuilds them every frame. A code reading was done before planning the extraction.

**Decision.** **Do not create a ParamRegistry module.** The premises do not hold up, and the extraction would relocate complexity rather than remove it — and it overlaps the deferred-leaf analysis already recorded in [ADR-0002](0002-animation-state-stays-one-module.md).

The reading found:

- **Static registries are already built once, not per frame.** `KALEIDO_PARAMS` (`kaleidoscope-params.ts`), `AUDIO_BARS_PARAMS` and `AUDIO_ZONES_PARAMS` (`animation.svelte.ts`) are module-level constants. `getAllAnimatableParams()` only spreads their references each call; it does **not** rebuild them. The proposed "memoize the static registries" win is already in place.
- **Construction is already centralized.** `animatable-params.ts` owns the `AnimatableParam` type and every builder (`buildAudioBarsParams`, `buildAudioZonesParams`, `buildRingWaveParams`, `buildRingMorphParams`) and is well tested (14 tests covering ids, get/set routing, ring-id stability). `kaleidoscope-params.ts` is the one static array, colocated with the kaleidoscope setters it closes over. What remains in `animation.svelte.ts` is the wiring (builders × live state) plus the `getAllAnimatableParams` orchestration — necessary glue that closes over `composition`, `animationState`, the setters, and the `m.*` labels.
- **The per-frame rebuild of per-ring params is deliberate and negligible.** Only `buildRingWaveParams`/`buildRingMorphParams` rebuild each call, and both skip rings without an override, so a typical frame allocates zero or a few small objects. Rebuilding is what keeps the get/set closures addressing the live array by index without stale indices. There is no measured regression; optimizing it is YAGNI.

## Considered options

- **Extract a ParamRegistry module (rejected).** It would pull a large dependency slice out of `animation.svelte.ts` — `composition`, `animationState`, `setAudioBarsConfig`, `setAudioZonesDefaultIntensity`, `updateRing`, `setRingMorphT`, `m.*`, `KALEIDO_PARAMS`, the builders — to host glue that has no behavior of its own. The complexity moves, it does not vanish (deletion test: deleting `getAllAnimatableParams` just inlines the same concatenation into `applyKeyframes`). This is the length-driven split [ADR-0002](0002-animation-state-stays-one-module.md) already declined for the `param-registry` leaf.
- **Add a direct test for `getAllAnimatableParams` (deferred, not done).** The one genuine gap is that the orchestration has no direct test — only the builders do. The concatenation is trivial and exercised indirectly through the apply loop and `TimelinePanel`. Add such a test only if the orchestration grows real logic (e.g. ordering or filtering rules beyond the current gate check).
- **Leave construction where it is (chosen).** Builders in `animatable-params.ts`, static arrays beside their state, wiring + orchestration in `animation.svelte.ts`.

## Consequences

- A future architecture review will again see param construction split across `animatable-params.ts`, `kaleidoscope-params.ts`, and `animation.svelte.ts` and may re-propose a ParamRegistry module. **This ADR is the standing answer:** construction is already centralized in `animatable-params.ts`, static registries are already memoized as module constants, and the per-frame per-ring rebuild is deliberate and negligible. Don't extract glue.
- If `getAllAnimatableParams` ever gains real logic, add a direct test for it then — that is the trigger, not the file split.
