import { describe, expect, it } from 'vitest';
import { resolveZoneIntensity } from './zones';

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
