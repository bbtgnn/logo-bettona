# Ring Dual-Path Interpolation Design

Date: 2026-04-25
Status: Approved for planning

## 1) Goal

Enable each ring to optionally define a second template path and a per-ring interpolation value `t` (`0..1`) that morphs between the primary and secondary paths before existing ring bending/rendering is applied.

Scope for this feature:
- Manual per-ring `t` control only.
- Programmatic animation support is deferred to a later feature.
- Path mismatch handling is strict/blocking (no auto-normalization or resampling in this phase).

## 2) Constraints and Decisions

- Interpolation is **per ring** (no global morph control in this scope).
- Secondary path is optional.
- If a ring has no secondary path, render exactly as today and ignore `t`.
- Secondary path authoring uses duplication of the current primary path as the starting point, then editing in the same ring editor.
- Mismatched path structures are blocked with validation errors.

## 3) Architecture

### Data model changes

Extend `Ring` with:
- `secondaryTemplatePath: Path | null` (optional morph target)
- `morphT: number` (default `0`, clamped `0..1`)

### Responsibility boundaries

- **State layer** (`src/lib/state/composition.ts`)
  - Owns `secondaryTemplatePath` and `morphT`.
  - Exposes mutation APIs for creating/removing/editing morph target and setting `t`.
- **Geometry layer** (`src/lib/geometry/`)
  - Owns path compatibility validation and interpolation math.
  - Produces derived template path for rendering.
- **Render pipeline** (`src/lib/geometry/render-pipeline.ts`)
  - Chooses render template per ring:
    - primary path if no secondary
    - interpolated path if secondary exists and validates
  - Keeps existing ring ordering, coloring, and fit behavior unchanged.
- **UI layer** (`src/lib/components/RingEditor.svelte`)
  - Exposes controls and displays validation errors.
  - Does not own interpolation math.

## 4) Component and Data Flow

1. User selects `Create morph target` on a ring.
2. State duplicates `templatePath` into `secondaryTemplatePath`.
3. User edits either `primary` or `secondary` path variant in the ring editor.
4. User adjusts per-ring `morphT` slider.
5. Render pipeline processes each ring:
   - if no secondary: use primary path unchanged
   - if secondary exists: validate compatibility and compute interpolated path
6. Interpolated (or primary) path is passed to existing `buildRingPath(...)`.

No changes are required to existing bend/copy topology logic beyond accepting the derived template path input.

## 5) Validation and Error Handling

### Compatibility requirements

Primary and secondary paths are compatible only when all are true:
- same `cmds.length`
- same command sequence at each index
- same `crds.length`

### Invalid-path behavior

- Reject incompatible secondary edits at state/update boundary.
- Surface a ring-level validation message in editor UI.
- Defensively re-check in render pipeline; on failure:
  - emit warning for diagnostics
  - fall back to primary path for rendering that ring
  - continue rendering other rings

### Numeric safety

- Clamp `morphT` to `[0, 1]` in state mutator.
- Geometry interpolation also clamps defensively.

## 6) Interpolation Algorithm

Given compatible paths `A` and `B`:
- `out.cmds = A.cmds`
- `out.crds[i] = A.crds[i] + (B.crds[i] - A.crds[i]) * t`

Special cases:
- `t=0` returns primary geometry.
- `t=1` returns secondary geometry.
- Rings without secondary skip interpolation and use primary geometry.

## 7) UI/UX Behavior

Per-ring controls:
- `Create morph target` (visible when no secondary path exists)
- `Remove morph target` (visible when secondary path exists)
- `Edit path variant` toggle: `Primary | Secondary`
- `Morph t` slider (`0..1`) for manual control

Rules:
- `Morph t` has visible effect only when secondary path exists.
- Removing morph target keeps primary path and current ring settings, and returns to single-path behavior.

## 8) State API Additions

Add the following state actions:
- `setRingMorphT(index: number, t: number): void`
- `createRingMorphTarget(index: number): void`
- `removeRingMorphTarget(index: number): void`
- `updateRingPathVariant(index: number, variant: 'primary' | 'secondary', path: Path): void`

Persistence remains unchanged via existing local storage synchronization.

## 9) Testing Strategy

### Unit tests (geometry)

- `interpolatePath`:
  - returns primary at `t=0`
  - returns secondary at `t=1`
  - returns midpoint at `t=0.5`
  - clamps out-of-range `t`
  - rejects mismatch (typed error/result)

### State tests

- creating morph target duplicates primary path
- removing morph target restores single-path mode
- path-variant updates route correctly to primary/secondary
- rings without secondary remain behaviorally equivalent to current rendering

### Render pipeline tests

- valid secondary path ring renders interpolated geometry
- invalid secondary/primary pair triggers warning + primary fallback
- per-ring behavior is isolated (one bad ring does not break full render)

### Component tests

- morph controls appear/disappear based on secondary-path presence
- path variant toggle drives edits to correct target
- slider updates per-ring `morphT`

## 10) Out of Scope

- Time-based play/loop morph animation controls
- Auto-normalization/resampling between incompatible path structures
- SVG-specific secondary path import workflow

## 11) Future Extension Notes

This design intentionally keeps `morphT` as a stable per-ring field so later programmatic animation can set `morphT` externally without changing interpolation math or ring rendering boundaries.
