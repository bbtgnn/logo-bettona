import { describe, it, expect, beforeEach } from 'vitest';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setSectors,
	setRepeat,
	setTileBackground,
	setKaleidoscopeBackgroundColor
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

	it('stores background color and tile-background flag', () => {
		setTileBackground(true);
		setKaleidoscopeBackgroundColor('#123456');
		expect(kaleidoscope.tileBackground).toBe(true);
		expect(kaleidoscope.backgroundColor).toBe('#123456');
	});
});
