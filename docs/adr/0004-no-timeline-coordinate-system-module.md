# No TimelineCoordinateSystem module — the equal-width invariant is CSS-structural, each row must measure its own node

**Context.** An architecture review ("candidate #5") flagged that the timeline playhead (`TimelinePanel.svelte`, measuring `laneColEl.clientWidth`) and each keyframe row (`TimelineTrack.svelte`, measuring `rowEl.clientWidth`) measure their width independently, then both convert through `xFromTime`/`timeFromX` (`timeline-geometry.ts`). It worried this is an implicit, behavioral "equal width" invariant that could drift and silently misalign the playhead from keyframes, and proposed a `TimelineCoordinateSystem` module owning one measured width that both consumers share. A DOM-layout reading was done before planning.

**Decision.** **Do not create a TimelineCoordinateSystem module.** The invariant it would protect is already guaranteed by shared CSS layout, and the module would be a pass-through that adds coupling.

The reading found:

- **Equal width is structural, not behavioral.** The ruler row and every track row are siblings inside one `timeline-tracks` stage (`width: zoom × 100%`) and use the identical flex template: `flex items-center gap-2` → a `w-28 shrink-0` gutter → a `flex-1` measured column. The `flex-1` columns therefore resolve to the same width by layout. `laneColEl.clientWidth === rowEl.clientWidth` holds because of CSS, not a runtime assumption that could quietly drift.
- **The converters are already a shared, deep-enough seam.** `xFromTime`/`timeFromX` in `timeline-geometry.ts` are pure, shared by both consumers, and tested (`timeline-geometry.spec.ts`). There is no duplicated conversion logic to concentrate.
- **Each row must measure its own DOM node.** The playhead reads `laneColEl`; each track reads its own `rowEl`. These are separate nodes in a zoomable, horizontally-scrollable stage. A single shared measured width would have to be prop-drilled into every `TimelineTrack` as a pixel count and kept fresh on zoom/resize — more coupling and a staleness risk, versus each node measuring itself live.

## Considered options

- **TimelineCoordinateSystem module owning one measured width + a runtime "widths match or throw" check (rejected).** Deletion test: remove it and nothing reappears — the converters stay pure in `timeline-geometry.ts`, each consumer still measures its own node. It would be a pass-through wrapper, and the runtime assertion would guard a CSS-guaranteed invariant. Net: noise plus prop-drilling.
- **Extract a shared constant for the `w-28` gutter width (rejected).** The only genuine drift risk is the gutter width being duplicated as a Tailwind class in `TimelinePanel` (ruler row) and `TimelineTrack`. But it is a CSS class, not DRY-able without inventing a component for a gutter; the cost outweighs the marginal safety.
- **Leave timeline geometry as is (chosen).** Pure converters in `timeline-geometry.ts`, each row measuring its own `flex-1` column, equal width guaranteed by the shared flex template.

## Consequences

- A future architecture review will again see two components measuring widths and calling `xFromTime`, and may re-propose a shared coordinate system. **This ADR is the standing answer:** the equal-width invariant is enforced by the shared CSS flex template (`w-28` gutter + `gap-2` + `flex-1` in a common-width stage), the converters are already shared and tested, and each row must measure its own DOM node — a single shared width would be prop-drilling plus staleness, not a deepening.
- If the two rows ever stop sharing the flex template (e.g. the gutter widths are styled independently), revisit by re-aligning the CSS, not by adding a runtime coordinate module.
