# logo-bettona

A generative logo/animation tool: concentric **Rings** built from vector paths, deformed by effects (morph, wave, zones, bend, kaleidoscope) and animated over a single normalized timeline.

## Language

**Ring**:
One concentric band of the composition — a vector template path repeated `copies` times, optionally morphed toward a secondary path and deformed by wave/zone effects. Lives in `Composition.rings`.
_Avoid_: layer, band, circle, level.

**Ring id**:
A stable string identity minted once per Ring at creation (`crypto.randomUUID`). It survives reorder and delete, so it — not the array index — is the key that animation Tracks and per-ring param ids hang off (`ring.<id>.morphT`). Array position stays valid only for transient, act-now operations (a setter on the current array); anything persisted keys by id.
_Avoid_: index, position, slot.

**Track**:
The keyframe animation for one animatable param, keyed by its param id and stored in the persisted keyframe store. A Track on a Ring param is keyed via the Ring id, so deleting or reordering a Ring never misattributes it.
_Avoid_: channel, curve, lane.

**Layer**:
A global on/off animation source over the whole timeline. The word spans three mechanisms, made explicit by `LAYER_KIND` in `animation.svelte.ts`: **driver** (audioBars, audioZones — register + activate a runtime driver), **gate** (kaleidoscope — its flag gates whether its `<layer>.*` keyframe params apply), **inert** (dataSeries — a parked placeholder, shown as unavailable, never runs). Distinct from a Ring.
_Avoid_: track, effect.

**Path / Path codec**:
The persisted shape of a Ring template is a **Path**: `cmds` (an `M/L/Q/C/Z` list) plus a flat `crds` number array packed by command arity (`$lib/types`). The **Path codec** (`geometry/path-codec.ts`) is the single translation between a Path and a live `paper.Path` — `toPaperPath(path, scope)` and `fromPaperPath(paperPath)`. It is the one home for that conversion; the point editor, `bend`, and SVG import all go through it rather than re-walking `cmds`/`crds`. `bend.getSegments` deliberately stays separate: it reads the same Path but into polar-prep `SegmentData`, a different output.
_Avoid_: for the codec — serializer, parser, adapter.

**Template space / polar space**:
A Ring's effect transforms run in two stages. **Template space** = the authored `(x, y)` bezier before bend; morph and wave apply here (unified in `composeRingTemplate`, pure). **Polar space** = after `buildRingPath` (`bend.ts`) maps `x → angle`, `y → radius`; zone deformation applies here, driven by `ring.zoneDrive`. Zone is polar-only by necessity — a template-space version is re-absorbed by bend's bbox normalization (see ADR-0001).
_Avoid_: world space, screen space.
