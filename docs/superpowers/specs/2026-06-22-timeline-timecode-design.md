# Timeline timecode readout + jump-to-time — design

**Date:** 2026-06-22
**Branch:** `feat/kaleidoscope`
**Status:** approved (design), pending implementation plan

## Context

While testing the animation timeline, the user asked for a **timecode**: a readout of the
current playhead position, and a way to **jump to a precise time**. Today the timeline
shows per-second ruler labels and a draggable playhead, but no current-time readout and no
way to type a target time. In audio mode an elapsed `m:ss` indicator already exists
(`formatElapsed`), but it is read-only and audio runs off a free clock.

This adds, in the non-audio (duration-based) transport, an editable current-time field
plus a total readout, both in `m:ss.cs` (minutes:seconds.centiseconds — precise enough for
short, few-second animations). Typing a time and committing jumps the playhead there.

## Scope

- Applies to the **non-audio** timeline mode (`!isAudioMode`), which has a fixed
  `durationSec`. Audio mode keeps its existing read-only elapsed indicator unchanged
  (jumping a free-running clock is out of scope).
- The existing **Duration** (`Dur … s`) input stays as-is (edits the total in seconds).
  The new total readout is a formatted, read-only mirror in `m:ss.cs`.

## Helpers — `src/lib/animation/timeline-geometry.ts`

Two pure functions (no DOM), unit-tested:

- `formatTimecode(sec: number): string` — formats seconds as `m:ss.cs`.
  - minutes = `Math.floor(sec / 60)`; whole seconds and centiseconds derived from the
    remainder; seconds zero-padded to 2 digits, centiseconds zero-padded to 2 digits.
  - Centisecond rounding must carry: `3.999` → `0:04.00`, `59.999` → `1:00.00`.
  - Negative or non-finite input clamps to `0:00.00`.
  - Examples: `0` → `0:00.00`; `3.25` → `0:03.25`; `65.5` → `1:05.50`.

- `parseTimecode(str: string): number | null` — parses a user-typed time to seconds.
  - Accepts `m:ss.cs`, `m:ss`, `ss.cs`, `ss` (and a bare decimal like `3.2`).
  - With a `:`, split once into `minutes` and `rest`; `minutes` must be a non-negative
    integer, `rest` a non-negative number of seconds; result = `minutes*60 + rest`.
  - Without a `:`, parse the whole string as a non-negative number of seconds.
  - Returns `null` for empty, non-numeric, negative, or malformed input (e.g. `"1:2:3"`,
    `"abc"`, `"-1"`).

## UI — `src/lib/components/TimelinePanel.svelte`

In the transport row, inside the `{:else}` (non-audio) branch next to the existing
Duration input, add a current/total timecode control:

- A text `<input>` showing the current time, plus a separator `/` and a read-only total
  (`formatTimecode(animationState.durationSec)`).
- **Live display:** while not being edited, the input shows
  `formatTimecode(animationState.progress * animationState.durationSec)`, so it updates as
  the playhead moves (including during playback). Implementation: track an `editing`
  boolean and an edit buffer string; when not editing, the input's value is the derived
  current timecode; on focus, seed the buffer from the current timecode and switch to it;
  on input, update the buffer; on Enter or blur, commit.
- **Commit (jump):** `parseTimecode(buffer)` → if `null`, discard (revert to current); else
  clamp to `[0, durationSec]` and `scrubTo(clampedSeconds / durationSec)` (guard
  `durationSec > 0`). Then leave editing mode.
- The input carries an `aria-label` (new message key `timeline_current_time`, EN+IT) so it
  is queryable/accessible. The total is a plain `<span>`.

`scrubTo` already exists in `src/lib/state/animation.ts` and sets `animationState.progress`
+ applies keyframes. No state-layer change.

## i18n

Add one key to BOTH `messages/en.json` and `messages/it.json`:
- `timeline_current_time` — EN "Current time (type to jump)" / IT "Tempo corrente (digita per saltare)".

## Testing

- `src/lib/animation/timeline-geometry.spec.ts` — unit tests for `formatTimecode`
  (`0`, `3.25`, `65.5`, carry cases `3.999`→`0:04.00` and `59.999`→`1:00.00`, negative→`0:00.00`)
  and `parseTimecode` (`"0:03.25"`→`3.25`, `"1:05.5"`→`65.5`, `"3.2"`→`3.2`, `""`/`"abc"`/`"-1"`/`"1:2:3"`→`null`).
- `src/lib/components/TimelinePanel.svelte.spec.ts` — with an armed param and a known
  `durationSec`, typing a valid timecode into the current-time field and pressing Enter sets
  `animationState.progress` to the expected fraction; an invalid entry leaves `progress`
  unchanged; the total readout shows the formatted `durationSec`.
- Gates: `bun run check`, `bun run test:unit -- run`, `bunx playwright test`, svelte-autofixer
  `issues: []` on `TimelinePanel.svelte`.

## Out of scope

- Audio-mode jump / editable elapsed.
- Frame-number display (SMPTE-style `m:ss:ff`); centiseconds were chosen instead.
- Changing the ruler's per-second `Ns` labels or the selected-keyframe `kf-time` readout.

## Acceptance

- The non-audio transport shows `current / total` in `m:ss.cs`; current updates live during
  playback and scrubbing.
- Typing a precise time and pressing Enter (or blurring) moves the playhead to that time;
  out-of-range clamps to the duration; invalid input is ignored.
- Audio mode is unchanged; all gates green.
