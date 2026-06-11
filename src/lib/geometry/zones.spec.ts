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
  it('returns a new identical copy when all pushes are 0', () => {
    const result = applyZonesToPath(petal, { bassPush: 0, midPush: 0, treblePush: 0 });
    expect(result).not.toBe(petal);
    expect(result.crds).not.toBe(petal.crds);
    expect(result.crds).toEqual(petal.crds);
    expect(result.cmds).toEqual(petal.cmds);
  });

  it('preserves cmds array and crds length for any drive', () => {
    const result = applyZonesToPath(petal, { bassPush: 10, midPush: 5, treblePush: 3 });
    expect(result.cmds).toEqual(petal.cmds);
    expect(result.crds).toHaveLength(petal.crds.length);
  });

  it('bass: moves outermost anchor (idx 6) + its entry handle (idx 4) + exit handle (idx 8) down by bassPush; leaves others unchanged', () => {
    const result = applyZonesToPath(petal, { bassPush: 10, midPush: 0, treblePush: 0 });
    // anchor Y: 30 - 10 = 20
    expect(result.crds[7]).toBeCloseTo(20, 6);
    // entry handle (C1 cp2) Y: 50 - 10 = 40
    expect(result.crds[5]).toBeCloseTo(40, 6);
    // exit handle (C2 cp1) Y: 25 - 10 = 15
    expect(result.crds[9]).toBeCloseTo(15, 6);
    // anchor X unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    // M anchor unchanged
    expect(result.crds[0]).toBe(petal.crds[0]);
    expect(result.crds[1]).toBe(petal.crds[1]);
    // C2 anchor unchanged
    expect(result.crds[12]).toBe(petal.crds[12]);
    expect(result.crds[13]).toBe(petal.crds[13]);
  });

  it('mid: moves middle anchor (idx 12) + entry handle (idx 10) right by midPush; leaves others unchanged', () => {
    const result = applyZonesToPath(petal, { bassPush: 0, midPush: 7, treblePush: 0 });
    // anchor X: 40 + 7 = 47
    expect(result.crds[12]).toBeCloseTo(47, 6);
    // entry handle (C2 cp2) X: 30 + 7 = 37
    expect(result.crds[10]).toBeCloseTo(37, 6);
    // exit handle: null for C2 → no change on any Y
    // C1 anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
    // M anchor unchanged
    expect(result.crds[0]).toBe(petal.crds[0]);
    expect(result.crds[1]).toBe(petal.crds[1]);
  });

  it('treble: moves innermost anchor (idx 0) + exit handle (idx 2) by +treblePush; leaves others unchanged', () => {
    const result = applyZonesToPath(petal, { bassPush: 0, midPush: 0, treblePush: 8 });
    // anchor Y: 100 + 8 = 108
    expect(result.crds[1]).toBeCloseTo(108, 6);
    // exit handle (C1 cp1) Y: 80 + 8 = 88
    expect(result.crds[3]).toBeCloseTo(88, 6);
    // entry handle: null for M → no change
    // C1 anchor unchanged
    expect(result.crds[6]).toBe(petal.crds[6]);
    expect(result.crds[7]).toBe(petal.crds[7]);
  });

  it('N=1: single anchor — bass wins', () => {
    const single: Path = { cmds: ['M'], crds: [10, 50] };
    const result = applyZonesToPath(single, { bassPush: 5, midPush: 3, treblePush: 2 });
    // Y = 50 - 5 = 45 (bass applied)
    expect(result.crds[1]).toBeCloseTo(45, 6);
    // X unchanged
    expect(result.crds[0]).toBe(10);
  });

  it('N=2: outermost gets bass, innermost gets treble, no mid', () => {
    const two: Path = { cmds: ['M', 'L'], crds: [0, 100, 0, 30] };
    // sorted: (0,30) idx=2 outermost → bass; (0,100) idx=0 innermost → treble
    const result = applyZonesToPath(two, { bassPush: 10, midPush: 99, treblePush: 5 });
    // outermost Y: 30 - 10 = 20
    expect(result.crds[3]).toBeCloseTo(20, 6);
    // innermost Y: 100 + 5 = 105
    expect(result.crds[1]).toBeCloseTo(105, 6);
    // X coords unchanged (no tangential move)
    expect(result.crds[0]).toBe(0);
    expect(result.crds[2]).toBe(0);
  });

  it('does not mutate the input path', () => {
    const original = [...petal.crds];
    applyZonesToPath(petal, { bassPush: 10, midPush: 5, treblePush: 3 });
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
