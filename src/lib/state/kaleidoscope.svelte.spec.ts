import { describe, it, expect, beforeEach } from 'vitest';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setSectors,
	setRepeat,
	setTileBackground
} from './kaleidoscope.svelte';

describe('kaleidoscope state', () => {
	beforeEach(() => {
		setKaleidoscopeEnabled(false);
		setSectors(6);
		setRepeat(2);
		setTileBackground(false);
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

	it('stores the tile-background flag', () => {
		setTileBackground(true);
		expect(kaleidoscope.tileBackground).toBe(true);
	});

	it('mirrors drawBackground as the inverse of tileBackground', () => {
		setTileBackground(true);
		expect(kaleidoscope.drawBackground).toBe(false);
		setTileBackground(false);
		expect(kaleidoscope.drawBackground).toBe(true);
	});
});
