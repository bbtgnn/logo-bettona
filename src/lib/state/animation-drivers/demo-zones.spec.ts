import { describe, expect, it } from 'vitest';
import { demoZones } from './demo-zones';

describe('demoZones', () => {
  it('returns all bands within 0..1', () => {
    for (let ms = 0; ms < 2000; ms += 37) {
      const z = demoZones(ms);
      for (const v of [z.bass, z.mid, z.treble]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('bass spikes hard on the kick then decays (transient, not a smooth wave)', () => {
    // Kick period = 500 ms (2 Hz). At the kick the bass is near max; shortly after it has clearly dropped.
    const atKick = demoZones(0).bass;
    const justAfter = demoZones(120).bass;
    expect(atKick).toBeGreaterThan(0.8);
    expect(atKick - justAfter).toBeGreaterThan(0.3); // sharp decay, not gentle
  });

  it('treble spikes on the offbeat hat, distinct from the kick', () => {
    // Hat at offbeat (kick period/2 = 250 ms). Treble high there, low at the kick.
    expect(demoZones(250).treble).toBeGreaterThan(0.6);
    expect(demoZones(0).treble).toBeLessThan(0.4);
  });

  it('is not a pure sine (a frame-to-frame drop sharper than any sine of the same period exists)', () => {
    // A 2 Hz sine over a 16 ms step changes at most ~0.1; our decay drops far more right after a spike.
    const drop = demoZones(20).bass - demoZones(140).bass;
    expect(drop).toBeGreaterThan(0.25);
  });
});
