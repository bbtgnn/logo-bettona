import { describe, expect, it } from 'vitest';
import { KALEIDO_PARAMS, KALEIDO_PARAM_BY_ID, type KaleidoParam } from './kaleidoscope-params';
import { kaleidoscope } from './kaleidoscope.svelte';
import { KALEIDO_GLOBAL_ROTATION } from './keyframes.svelte';

describe('KALEIDO_PARAMS registry', () => {
	it('exposes the 8 animatable sliders with unique ids', () => {
		expect(KALEIDO_PARAMS).toHaveLength(8);
		const ids = KALEIDO_PARAMS.map((p) => p.id);
		expect(new Set(ids).size).toBe(8);
	});

	it('includes globalRotation under the Block-2 track id', () => {
		const rot = KALEIDO_PARAM_BY_ID[KALEIDO_GLOBAL_ROTATION];
		expect(rot).toBeDefined();
		expect(rot.min).toBe(0);
		expect(rot.max).toBe(360);
	});

	it('get/set round-trips a continuous param through state', () => {
		const scale = KALEIDO_PARAM_BY_ID['kaleidoscope.scale'];
		scale.set(1.5);
		expect(scale.get()).toBe(1.5);
		expect(kaleidoscope.scale).toBe(1.5);
	});

	it('set clamps sectors to an even value in range', () => {
		const sectors = KALEIDO_PARAM_BY_ID['kaleidoscope.sectors'];
		sectors.set(9.4);
		expect(sectors.get()).toBe(8); // 9.4 -> round 9 -> even 8
		sectors.set(99);
		expect(sectors.get()).toBe(24);
	});

	it('set clamps repeat to an integer in range', () => {
		const repeat = KALEIDO_PARAM_BY_ID['kaleidoscope.repeat'];
		repeat.set(3.9);
		expect(repeat.get()).toBe(3);
		repeat.set(-2);
		expect(repeat.get()).toBe(1);
	});

	it('every entry id matches its KALEIDO_PARAM_BY_ID key', () => {
		for (const p of KALEIDO_PARAMS as KaleidoParam[]) {
			expect(KALEIDO_PARAM_BY_ID[p.id]).toBe(p);
		}
	});
});
