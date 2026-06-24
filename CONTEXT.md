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
A global on/off animation source over the whole timeline (audioBars, audioZones, kaleidoscope, dataSeries). Note the word currently spans three different mechanisms (runtime driver / keyframe gate / placeholder) — see the architecture review. Distinct from a Ring.
_Avoid_: track, effect.

**Template space / polar space**:
A Ring's effect transforms run in two stages. **Template space** = the authored `(x, y)` bezier before bend; morph and wave apply here (unified in `composeRingTemplate`, pure). **Polar space** = after `buildRingPath` (`bend.ts`) maps `x → angle`, `y → radius`; zone deformation applies here, driven by `ring.zoneDrive`. Zone is polar-only by necessity — a template-space version is re-absorbed by bend's bbox normalization (see ADR-0001).
_Avoid_: world space, screen space.
