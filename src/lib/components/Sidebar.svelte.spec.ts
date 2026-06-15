import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';

const sidebarContext = vi.hoisted(() => ({
	useSidebar: () => ({
		isMobile: false,
		state: 'expanded',
		openMobile: false,
		setOpenMobile: vi.fn()
	}),
	setSidebar: vi.fn()
}));

vi.mock('$lib/shadcn/ui/sidebar/context.svelte.js', () => sidebarContext);

vi.mock('$lib/state/animation', () => ({
	animationState: {
		mode: null,
		isPlaying: false,
		isPaused: false,
		progress: 0,
		durationSec: 3,
		loop: false,
		alternate: false,
		audioBars: { smoothing: 0.5, minHz: 20, maxHz: 20000, waveCrests: 3, waveAmplitudeGain: 0.3, wavePhaseSpeed: 2.2, inputGain: 1 },
		audioZones: { defaultIntensity: { bass: 0.5, mid: 0.5, treble: 0.5 } },
		audioSource: 'demo',
		elapsedMs: 0
	},
	togglePlay: vi.fn(),
	setAnimationMode: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn(),
	setAudioBarsConfig: vi.fn(),
	setAudioZonesDefaultIntensity: vi.fn(),
	setAudioSource: vi.fn(),
	audioSource: { loadFile: vi.fn(), play: vi.fn(), pause: vi.fn(), readLevel: vi.fn(() => 0) }
}));

vi.mock('$lib/state/composition', () => ({
	composition: {
		baseRadius: 100,
		ringIncrement: 50,
		rings: [],
		monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
		fullPalettes: [{ colors: ['#000000', '#ffffff'] }]
	},
	colorMode: { mode: 'monochrome', palette: 0 },
	addRing: vi.fn(),
	removeRing: vi.fn(),
	updateRing: vi.fn(),
	reorderRings: vi.fn(),
	setBaseRadius: vi.fn(),
	setRingIncrement: vi.fn(),
	setColorMode: vi.fn(),
	setActivePalette: vi.fn(),
	addMonochromePalette: vi.fn(),
	updateMonochromePalette: vi.fn(),
	removeMonochromePalette: vi.fn(),
	addFullPalette: vi.fn(),
	updateFullPalette: vi.fn(),
	removeFullPalette: vi.fn(),
	reshuffle: vi.fn(),
	setRingExpanded: vi.fn(),
	isRingExpanded: vi.fn(() => true),
	createRingMorphTarget: vi.fn(),
	removeRingMorphTarget: vi.fn(),
	setRingMorphT: vi.fn(),
	updateRingPathVariant: vi.fn(() => ({ ok: true })),
	setCompositionRotation: vi.fn()
}));

import Sidebar from './Sidebar.svelte';

describe('Sidebar section order', () => {
	it('renders Settings, Rings, Colors, Animation in order', async () => {
		render(Sidebar);

		const content = page.getByTestId('sidebar-content');
		await expect.element(content).toBeInTheDocument();

		const contentElement = await content.element();
		const text = contentElement.textContent ?? '';

		const settingsIndex = text.indexOf('Settings');
		const ringsIndex = text.indexOf('Rings');
		const colorsIndex = text.indexOf('Colors');
		const animationIndex = text.indexOf('Animation');

		expect(
			settingsIndex,
			'Expected "Settings" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			ringsIndex,
			'Expected "Rings" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			colorsIndex,
			'Expected "Colors" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			animationIndex,
			'Expected "Animation" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);

		expect(ringsIndex).toBeGreaterThan(settingsIndex);
		expect(colorsIndex).toBeGreaterThan(ringsIndex);
		expect(animationIndex).toBeGreaterThan(colorsIndex);
	});
});