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
		mode: 'morphSweep',
		isPlaying: false,
		isPaused: false,
		progress: 0,
		durationSec: 3,
		loop: false,
		alternate: false
	},
	togglePlay: vi.fn(),
	setAnimationDurationSec: vi.fn(),
	setAnimationLoop: vi.fn(),
	setAnimationAlternate: vi.fn(),
	handleCompositionChanged: vi.fn()
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
	updateRingPathVariant: vi.fn(() => ({ ok: true }))
}));

import Sidebar from './Sidebar.svelte';

describe('Sidebar section order', () => {
	it('renders Settings, Animation, Colors, Rings in order', async () => {
		render(Sidebar);

		const content = page.getByTestId('sidebar-content');
		await expect.element(content).toBeInTheDocument();

		const contentElement = await content.element();
		const text = contentElement.textContent ?? '';

		const settingsIndex = text.indexOf('Settings');
		const animationIndex = text.indexOf('Animation');
		const colorsIndex = text.indexOf('Colors');
		const ringsIndex = text.indexOf('Rings');

		expect(
			settingsIndex,
			'Expected "Settings" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			animationIndex,
			'Expected "Animation" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			colorsIndex,
			'Expected "Colors" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);
		expect(
			ringsIndex,
			'Expected "Rings" section to be present in sidebar content'
		).toBeGreaterThanOrEqual(0);

		expect(animationIndex).toBeGreaterThan(settingsIndex);
		expect(colorsIndex).toBeGreaterThan(animationIndex);
		expect(ringsIndex).toBeGreaterThan(colorsIndex);
	});
});
