# Report — Timeline Polish (done) + Tool Restructure (vision)

**Date:** 2026-06-19
**Branch:** `feat/kaleidoscope` — HEAD `f231905` (local; NOT pushed, NOT merged)
**Audience:** the designer (next-step planning) + whoever picks up the restructure

---

## 1. What's done — Timeline UI Polish

Shipped as 7 TDD commits, range `40c23a9..c282b0e`. Final whole-branch review (opus): **MERGE-READY**, 0 Critical / 0 Important. A follow-up commit `f231905` then fixed the Graph Editor (§2a). **372 unit tests green**, `bun run check` 0 errors, all `.svelte` pass svelte-autofixer (`issues: []`).

| # | Change |
|---|--------|
| 1 | Timeline panel renders **only when kaleidoscope mode is on** (`kaleidoscope.enabled`). |
| 2 | Header: a **chevron** ▸ is the only open/close control; **Timeline / Graph Editor are view tabs** that switch view and never close the panel (fixed the bug where pressing Timeline in graph mode closed the panel). |
| 3 | Ruler shows **tick marks + time labels** (`0s · 1.5s · 3s`) from `animationState.durationSec`, via new `formatSeconds()`. |
| 4 | **Single continuous playhead** overlay spanning ruler + lanes (moved out of the ruler onto the panel stage; lane column measured at runtime). |
| 5 | Keyframe **selection lifted to the panel**; interpolation + delete moved into **one contextual bar** shown only when a keyframe is selected; `+ Keyframe` became a compact icon. |
| 6 | Selected keyframe: **blue ring** + guide line + **time label** (`time × durationSec`). |
| 7 | Minimal spacing/color pass (clean look). |

Files: `TimelinePanel.svelte`, `TimelineTrack.svelte`, `TimelineRuler.svelte`, `timeline-geometry.ts` (+ specs). Spec: `docs/superpowers/specs/2026-06-19-timeline-ui-polish-design.md`. Plan: `docs/superpowers/plans/2026-06-19-timeline-ui-polish.md`. Progress ledger: `.git/sdd/progress.md` (section "TIMELINE UI POLISH").

**Next mechanical step (designer's call):** commit is already done; **push `feat/kaleidoscope`** and decide PR-vs-direct-merge to `main`. This branch also still carries the un-merged Kaleidoscope Blocks 1–3.

---

## 2. Open observations from the live check

These came out of the designer trying the polished timeline. They are **not** regressions from the polish work — they're pre-existing product/UX gaps to fold into the restructure.

### 2a. Graph Editor feels empty / purpose unclear — ✅ FIXED (`f231905`)
The Graph Editor (`KeyframeGraphEditor.svelte`) draws a value-over-time curve + draggable points for one armed parameter. It only showed something once that parameter had keyframes; arming a stopwatch without adding keyframes rendered an **empty grey box** → read as "nothing appears", and it never explained what it was for.
- **Done this branch:** an always-on **help caption** ("Trascina i punti per regolare tempo e valore; le maniglie (Bézier) per l'accelerazione.") and, when the track has **no keyframes**, an **empty-state hint** ("Nessun keyframe… Aggiungine dalla vista Timeline per modellarne la curva.") instead of a blank box.
- Still open for the Animate redesign (§3): whether the graph default-selects a param that already has keyframes, and the broader role of the graph editor.

### 2b. Animation duration is not legible
There's no clear, single place that says **how long the animation is** (`durationSec`, default 3s) or lets you set it confidently. The ruler now shows end-time, but the duration control itself is buried.

### 2c. Three overlapping "timeline"-like surfaces
Today animation/keyframe controls are spread across **three places**, which is confusing:
1. The **sidebar** (per-parameter stopwatch + sliders).
2. The **kaleidoscope timeline panel** (this work).
3. The **controls under the canvas** (play/duration/export).

The redundancy — not any single control — is the real problem.

---

## 3. Vision — split the tool into 3 sections (next phase)

> Big restructure. To be planned step by step **after** the timeline branch is pushed. This section captures the intent only; it is **not** an approved design yet.

Proposed top-level split:

- **Editor** — where the mark/logo is *modelled* (shapes, paths, colors — the static design).
- **Animate** — *all* animation in one place: timeline, keyframes, graph editor, duration, play/export. Collapses the three overlapping surfaces (§2c) into one coherent workspace.
- **Paths** — the current `/paths`, repurposed as an **archive of shapes** and a **preset selector** for them.

Plus: **animation presets** — ready-made animations the user can apply (and probably save) from the Animate section.

### Open questions to resolve when we plan this
- Navigation model: top tabs? routes (`/editor`, `/animate`, `/paths`)? The app already uses routes (`+page.svelte`, `/paths`, `/about`).
- What exactly moves into **Animate**, and does the kaleidoscope timeline become the general animation timeline (not kaleidoscope-only)?
- Duration as a first-class control in Animate (fixes §2b).
- Graph Editor's role and empty-state inside Animate (fixes §2a).
- Animation-preset data model: where presets are stored, how they apply to the current mark, can the user author/save them.
- Migration: how to get there in safe, shippable steps (each step working software).

### Suggested sequencing
1. **Push / merge** the timeline branch (clears the board).
2. **Brainstorm** the 3-section split → spec (`brainstorming` skill).
3. **Plan** as independent vertical slices (`writing-plans` / `to-issues`), e.g.: introduce the 3-section nav shell → move existing animation controls into Animate (consolidate §2c) → duration as first-class → graph-editor empty-state/clarity → Paths-as-archive + shape presets → animation presets.
4. Build slice by slice.

---

## Status summary
- Timeline polish: **complete, reviewed MERGE-READY, committed, not pushed.**
- Immediate action: designer commits already done → **push + merge decision**.
- After that: restructure planning (this report §3) as its own brainstorm → spec → plan cycle.
