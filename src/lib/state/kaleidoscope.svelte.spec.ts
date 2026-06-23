import { describe, it, expect, beforeEach } from 'vitest';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setSectors,
	setRepeat,
	setLiveTile
} from './kaleidoscope.svelte';

describe('kaleidoscope state', () => {
	beforeEach(() => {
		setKaleidoscopeEnabled(false);
		setSectors(6);
		setRepeat(2);
		setLiveTile(false);
	});

	it('toggles enabled', () => {
		setKaleidoscopeEnabled(true);
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('clamps sectors to even 4..24', () => {
		setSectors(7);
		expect(kaleidoscope.sectors).toBe(6);
		setSectors(100);
		expect(kaleidoscope.sectors).toBe(24);
	});

	it('clamps repeat to 1..10', () => {
		setRepeat(99);
		expect(kaleidoscope.repeat).toBe(10);
	});

	it('toggles the live tile flag', () => {
		setLiveTile(true);
		expect(kaleidoscope.liveTile).toBe(true);
		setLiveTile(false);
		expect(kaleidoscope.liveTile).toBe(false);
	});

	it('always paints its own background (drawBackground constant true)', () => {
		expect(kaleidoscope.drawBackground).toBe(true);
	});
});
