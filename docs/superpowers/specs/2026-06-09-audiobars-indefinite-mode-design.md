# audioBars Indefinite Mode — Design

**Date:** 2026-06-09
**Branch:** feat/add-audioreactive

---

## Problem

In audioBars mode, the logo reacts to audio input only for `durationSec` (default 3 s), then stops. This value is not surfaced in the UI when audioBars is active and cannot be changed without leaving the mode. The duration concept belongs to morph/simple animation, not to live-reactive audio.

---

## Goal

Remove the duration dependency from audioBars mode. The logo should react:
- **file source** — for the entire playback of the file (AudioFilePanel already owns transport)
- **mic / demo source** — indefinitely, until the user explicitly pauses or switches mode

---

## Approach

**A — minimal patch.** One-line fix in the tick loop; targeted UI swap in AnimationSection. No new driver code, no architectural changes.

---

## Design

### 1. Core tick fix — `animation.svelte.ts`

`hasCompleted(elapsedMs)` returns `false` when `animationState.mode === 'audioBars'`. All other modes (simple, dataSeries) are unaffected.

`logicalElapsedMs` keeps incrementing normally and becomes the source for the elapsed-time display. It resets to 0 on `stopInternal`.

Add one field to `AnimationState`:

```ts
elapsedMs: number;  // initialised to 0
```

Set it inside `tick()`:

```ts
animationState.elapsedMs = logicalElapsedMs;
```

Reset in `stopInternal()` already handled via `logicalElapsedMs = 0` → also set `animationState.elapsedMs = 0` there.

### 2. Transport UI — `AnimationSection.svelte`

`hideGlobalTransport` condition is unchanged (`audioBars && file`). The existing `{#if !hideGlobalTransport}` block is split into two branches:

**Branch A — audioBars + mic/demo**
(`animationState.mode === 'audioBars' && animationState.audioSource !== 'file'`)

Replaces duration + progress with:
```
[Play / Pause]   0:04
```

- Play/Pause calls existing `togglePlay()`
- Elapsed counter formatted as `M:SS` from `animationState.elapsedMs`
- No duration field, no progress bar

**Branch B — all other modes**

Existing layout: Duration field + Play/Pause + progress bar. Unchanged.

**Branch C — audioBars + file**

Hidden by `hideGlobalTransport`. AudioFilePanel owns transport. No change.

### 3. Edge cases

| Scenario | Behaviour |
|----------|-----------|
| Mode switch while playing (audioBars → simple) | `setAnimationMode` triggers `reconfigureCurrentAnimation` → `stopInternal` → `logicalElapsedMs` resets |
| Pause / resume in mic or demo mode | Tick loop pauses; `logicalElapsedMs` freezes; counter holds value; resume continues from same value |
| File finishes playing in audioBars + file | `<audio>` stops; analyser reads silence; wave amplitude decays to zero; loop keeps running; user pauses via AudioFilePanel |
| Stop via `stopInternal` | `logicalElapsedMs = 0`; `animationState.elapsedMs = 0`; counter resets to 0:00 |

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/state/animation.svelte.ts` | Add `elapsedMs` to `AnimationState`; patch `hasCompleted`; set `animationState.elapsedMs` in `tick` and `stopInternal` |
| `src/lib/components/AnimationSection.svelte` | Split transport block into Branch A (audioBars mic/demo) and Branch B (other modes) |

---

## Out of scope

- audioBars + file end-of-file auto-stop (AudioFilePanel loop checkbox handles user preference)
- Per-source progress indicators beyond elapsed timer
- Pause semantics change (Play/Pause, not Play/Stop)
