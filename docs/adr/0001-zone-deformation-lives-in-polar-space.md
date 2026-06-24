# Zone deformation lives in polar space, inside bend — not as a path transform

**Context.** Audio-zone deformation (bass/mid/treble pushing a petal's tips) needs to move the outer tip *outward toward the reserved canvas edge*. A ring's authored template is mapped into final polar space by `buildRingPath` (`bend.ts`), which normalizes the template's bounding box before mapping `x → angle`, `y → radius`.

**Decision.** Zone deformation is applied **in final polar space, inside `buildRingPath`** (driven by `ring.zoneDrive`), after the angle/radius mapping. It is deliberately **not** a `Path → Path` transform on the authored template. The template-space implementation (`zones.ts:applyZonesToPath`) was abandoned and is being deleted; only `resolveZoneIntensity` survives.

By contrast, the **morph** and **wave** transforms *do* operate on the authored template (template space), before bend — those are unified in the pure `composeRingTemplate` (`compose-ring.ts`).

## Considered options

- **Template-space path transform (rejected).** Translating anchors in normalized template `(x, y)` before bend reads cleanly and would make zones composable alongside morph/wave. It was tried (`zones.ts:applyZonesToPath`, since deleted) and abandoned: `buildRingPath` normalizes the template bounding box, so a radial push applied in template space is **re-absorbed by that normalization** — the tip never escapes the thin ring band. See the `bend.ts` header comment for the live polar-space rationale.
- **Polar-space deformation inside bend (chosen).** Pushing `radius`/`angle` after the polar mapping lets the tip travel toward the reserved edge, which is the whole point.

## Consequences

- A path-transform pipeline that composes morph + wave + zone uniformly is **not possible**; zone is a polar-space concern by necessity. The transform "chain" is two-staged: template-space prep (`composeRingTemplate`) then polar build-with-zone (`buildRingPath`).
- A future architecture review will see `zones.ts` was deleted as dead code and may re-suggest a template-space "extract zones into a path transform." This ADR is the standing answer: it was tried, it doesn't work geometrically.
