import { describe, expect, it } from 'vitest';
import type { Path } from '$lib/types';
import {
  applyZonesToPath,
  resolveZoneIntensity,
  BASS_REACH,
  MID_X_REACH,
  MID_Y_REACH,
  TREBLE_RETRACT,
  VIBR_REACH
} from './zones';

// 3-anchor petal: M=(0,100) inner, first-C=(10,30) outer, second-C=(40,60) middle
// Parsed anchor order by Y ascending: (10,30) → bass, (40,60) → mid, (0,100) → treble
// crds indices: M-anchor=0, C1-cp1=2, C1-cp2=4, C1-anchor=6, C2-cp1=8, C2-cp2=10, C2-anchor=12
// After parsing:
//   M: {anchorIdx:0, entry:null, exit:2}   (exit set when first C is parsed)
//   C1: {anchorIdx:6, entry:4, exit:8}
//   C2: {anchorIdx:12, entry:10, exit:null}
const petal: Path = {
  cmds: ['M', 'C', 'C'],
  crds: [
    0, 100,              // M anchor (idx 0,1) — innermost Y=100
    0, 80, 5, 50, 10, 30, // C1: cp1(idx2,3), cp2(idx4,5), anchor(idx6,7) — outermost Y=30
    20, 25, 30, 30, 40, 60 // C2: cp1(idx8,9), cp2(idx10,11), anchor(idx12,13) — middle Y=60
  ]
};

describe('applyZonesToPath', () => {
  it('returns a new identical copy when all drive fields are 0', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    expect(result).not.toBe(petal);
    expect(result.crds).not.toBe(petal.crds);
    expect(result.crds).toEqual(petal.crds);
    expect(result.cmds).toEqual(petal.cmds);
  });

  it('preserves cmds array and crds length for any drive', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 5,
      trebleRetract: 3,
      trebleVibrate: 2
    });
    expect(result.cmds).toEqual(petal.cmds);
    expect(result.crds).toHaveLength(petal.crds.length);
  });

  // `petal` radial extent = maxY(100) - minY(30) = 70. Deltas scale by extent × REACH.
  const RADIAL_EXTENT = 70;

  it('bass pushes the outermost anchor (idx 6) + handles radially out by extent * BASS_REACH', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 1,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    const d = RADIAL_EXTENT * BASS_REACH;
    expect(result.crds[7]).toBeCloseTo(30 - d, 6); // outer anchor Y
    expect(result.crds[5]).toBeCloseTo(50 - d, 6); // entry handle Y
    expect(result.crds[9]).toBeCloseTo(25 - d, 6); // exit handle Y
    expect(result.crds[6]).toBe(petal.crds[6]); // X unchanged
    expect(result.crds[0]).toBe(petal.crds[0]); // M anchor unchanged
    expect(result.crds[1]).toBe(petal.crds[1]);
    expect(result.crds[12]).toBe(petal.crds[12]); // C2 anchor unchanged
    expect(result.crds[13]).toBe(petal.crds[13]);
  });

  it('mid widens the middle anchor (idx 12) in +x and nudges it out in -y, both extent-scaled', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 1,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    const dx = RADIAL_EXTENT * MID_X_REACH;
    const dy = RADIAL_EXTENT * MID_Y_REACH;
    expect(result.crds[12]).toBeCloseTo(40 + dx, 6); // anchor X
    expect(result.crds[13]).toBeCloseTo(60 - dy, 6); // anchor Y (radial out = decrease Y)
    expect(result.crds[10]).toBeCloseTo(30 + dx, 6); // entry handle X
    expect(result.crds[11]).toBeCloseTo(30 - dy, 6); // entry handle Y
    expect(result.crds[6]).toBe(petal.crds[6]); // outer anchor unchanged
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('treble retracts the innermost anchor (idx 0) in +y and jitters it in x, extent-scaled', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 1,
      trebleVibrate: 1
    });
    const dy = RADIAL_EXTENT * TREBLE_RETRACT;
    const dx = RADIAL_EXTENT * VIBR_REACH;
    expect(result.crds[1]).toBeCloseTo(100 + dy, 6); // M anchor Y retract inward
    expect(result.crds[0]).toBeCloseTo(0 + dx, 6); // M anchor X jitter
    expect(result.crds[2]).toBeCloseTo(0 + dx, 6); // exit handle X
    expect(result.crds[3]).toBeCloseTo(80 + dy, 6); // exit handle Y
    expect(result.crds[6]).toBe(petal.crds[6]); // outer anchor unchanged
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('negative trebleVibrate shifts innermost X the other way', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: -1
    });
    expect(result.crds[0]).toBeCloseTo(0 - RADIAL_EXTENT * VIBR_REACH, 6);
  });

  it('magnitude scales with radial extent (double extent → double delta)', () => {
    // Same petal stretched: outer Y=0, middle Y=60, inner Y=140 → extent 140.
    const tall: Path = {
      cmds: ['M', 'C', 'C'],
      crds: [0, 140, 0, 80, 5, 50, 10, 0, 20, 25, 30, 30, 40, 60]
    };
    const result = applyZonesToPath(tall, {
      bassPush: 1,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    // outermost is now C1 anchor (Y=0); extent = 140.
    expect(result.crds[7]).toBeCloseTo(0 - 140 * BASS_REACH, 6);
  });

  it('returns an unchanged copy when radial extent is zero', () => {
    const flat: Path = { cmds: ['M', 'L'], crds: [0, 50, 20, 50] }; // both anchors Y=50
    const result = applyZonesToPath(flat, {
      bassPush: 1,
      midPush: 1,
      trebleRetract: 1,
      trebleVibrate: 1
    });
    expect(result.crds).toEqual(flat.crds);
    expect(result.crds).not.toBe(flat.crds);
  });

  it('N=1: single anchor has zero extent → unchanged copy', () => {
    const single: Path = { cmds: ['M'], crds: [10, 50] };
    const result = applyZonesToPath(single, {
      bassPush: 1,
      midPush: 1,
      trebleRetract: 1,
      trebleVibrate: 1
    });
    expect(result.crds).toEqual(single.crds);
    expect(result.crds).not.toBe(single.crds);
  });

  it('N=2: outermost gets bass, innermost gets treble, no mid (extent-scaled)', () => {
    const two: Path = { cmds: ['M', 'L'], crds: [0, 100, 0, 30] }; // extent 70
    const result = applyZonesToPath(two, {
      bassPush: 1,
      midPush: 99,
      trebleRetract: 1,
      trebleVibrate: 1
    });
    expect(result.crds[3]).toBeCloseTo(30 - 70 * BASS_REACH, 6); // outermost bass
    expect(result.crds[1]).toBeCloseTo(100 + 70 * TREBLE_RETRACT, 6); // innermost retract
    expect(result.crds[0]).toBeCloseTo(0 + 70 * VIBR_REACH, 6); // innermost X jitter
    expect(result.crds[2]).toBe(0); // outermost X unchanged
  });

  it('does not mutate the input path', () => {
    const original = [...petal.crds];
    applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 5,
      trebleRetract: 3,
      trebleVibrate: 2
    });
    expect(petal.crds).toEqual(original);
  });
});

describe('resolveZoneIntensity', () => {
  const def = { bass: 0.5, mid: 0.5, treble: 0.5 };

  it('returns def when ring has no zoneConfig', () => {
    expect(resolveZoneIntensity({}, def)).toEqual(def);
  });

  it('returns def when ring.zoneConfig is null', () => {
    expect(resolveZoneIntensity({ zoneConfig: null }, def)).toEqual(def);
  });

  it('returns ring.zoneConfig when set, ignoring def', () => {
    const override = { bass: 0.9, mid: 0.1, treble: 0.7 };
    expect(resolveZoneIntensity({ zoneConfig: override }, def)).toEqual(override);
  });
});
