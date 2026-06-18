import { describe, expect, it } from 'vitest';
import type { Path } from '$lib/types';
import { applyZonesToPath, resolveZoneIntensity, ZONE_SCALE } from './zones';

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

  it('bass: moves outermost anchor (idx 6) + handles (idx 4, 8) down by bassPush', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 10,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    expect(result.crds[7]).toBeCloseTo(20, 6); // 30 - 10
    expect(result.crds[5]).toBeCloseTo(40, 6); // 50 - 10
    expect(result.crds[9]).toBeCloseTo(15, 6); // 25 - 10
    expect(result.crds[6]).toBe(petal.crds[6]); // X unchanged
    expect(result.crds[0]).toBe(petal.crds[0]); // M anchor unchanged
    expect(result.crds[1]).toBe(petal.crds[1]);
    expect(result.crds[12]).toBe(petal.crds[12]); // C2 anchor unchanged
    expect(result.crds[13]).toBe(petal.crds[13]);
  });

  it('mid: moves middle anchor (idx 12) right by midPush AND up by midPush*0.4', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 10,
      trebleRetract: 0,
      trebleVibrate: 0
    });
    // X: 40 + 10 = 50
    expect(result.crds[12]).toBeCloseTo(50, 6);
    // Y: 60 - 10*0.4 = 56 (radial out = decrease Y)
    expect(result.crds[13]).toBeCloseTo(56, 6);
    // entry handle (idx 10,11): X 30+10=40, Y 30-4=26
    expect(result.crds[10]).toBeCloseTo(40, 6);
    expect(result.crds[11]).toBeCloseTo(26, 6);
    // C1 (outer) anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('treble: retracts innermost anchor (idx 0) inward by trebleRetract AND shifts X by trebleVibrate', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 8,
      trebleVibrate: 3
    });
    // innermost is M anchor at (0,100): Y 100 + 8 = 108, X 0 + 3 = 3
    expect(result.crds[1]).toBeCloseTo(108, 6);
    expect(result.crds[0]).toBeCloseTo(3, 6);
    // exit handle (C1 cp1 idx 2,3): X 0+3=3, Y 80+8=88
    expect(result.crds[2]).toBeCloseTo(3, 6);
    expect(result.crds[3]).toBeCloseTo(88, 6);
    // C1 (outer) anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('negative trebleVibrate shifts innermost X the other way', () => {
    const result = applyZonesToPath(petal, {
      bassPush: 0,
      midPush: 0,
      trebleRetract: 0,
      trebleVibrate: -5
    });
    expect(result.crds[0]).toBeCloseTo(-5, 6);
  });

  it('N=1: single anchor — bass wins', () => {
    const single: Path = { cmds: ['M'], crds: [10, 50] };
    const result = applyZonesToPath(single, {
      bassPush: 5,
      midPush: 3,
      trebleRetract: 2,
      trebleVibrate: 1
    });
    expect(result.crds[1]).toBeCloseTo(45, 6); // 50 - 5 (bass)
    expect(result.crds[0]).toBe(10);
  });

  it('N=2: outermost gets bass, innermost gets treble, no mid', () => {
    const two: Path = { cmds: ['M', 'L'], crds: [0, 100, 0, 30] };
    const result = applyZonesToPath(two, {
      bassPush: 10,
      midPush: 99,
      trebleRetract: 5,
      trebleVibrate: 4
    });
    expect(result.crds[3]).toBeCloseTo(20, 6); // outermost 30 - 10
    expect(result.crds[1]).toBeCloseTo(105, 6); // innermost 100 + 5 retract
    expect(result.crds[0]).toBeCloseTo(4, 6); // innermost X + vibrate
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

describe('ZONE_SCALE', () => {
  it('is a positive number', () => {
    expect(typeof ZONE_SCALE).toBe('number');
    expect(ZONE_SCALE).toBeGreaterThan(0);
  });
});
