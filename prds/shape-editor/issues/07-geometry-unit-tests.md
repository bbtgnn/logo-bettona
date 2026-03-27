done: false
---

## Parent PRD

prds/shape-editor/index.md

## What to build

Write unit tests for the three geometry modules. Tests must cover only external behavior — inputs and outputs — not implementation details. See the **Testing Decisions** section of the parent PRD.

**`bend.ts`**:
- A straight horizontal line as template with `copies: 1` should produce a path whose points lie on a circular arc
- Collinearity of in/out handles through an anchor is preserved after transformation
- A ring with `copies: 4` produces a path with 4-fold rotational symmetry

**`svg-import.ts`**:
- Extracts the correct path from a minimal SVG string containing one path
- Returns `null` for an SVG with no paths
- Returns `null` for malformed input
- A registered preprocessor function is called with the imported `paper.Item` before extraction

**`compose.ts`** (integration):
- Composing a 2-ring composition produces 2 paper.js paths in the project
- The path for index 0 (innermost) is drawn on top (higher z-order) than index 1

## Acceptance criteria

- [ ] Tests for `bend.ts` pass: arc output, collinearity, rotational symmetry
- [ ] Tests for `svg-import.ts` pass: extraction, null on invalid, preprocessor hook invocation
- [ ] Integration test for `compose.ts` passes: 2-ring composition produces 2 paths in correct draw order
- [ ] All tests run via `bun run test:unit`
- [ ] No tests rely on internal implementation details (private functions, intermediate state)

## Blocked by

- Blocked by `prds/shape-editor/issues/05-geometry-bend-compose-live-preview.md`

## User stories addressed

- (No direct user stories — this is a quality/correctness guarantee for issues 04 and 05)
