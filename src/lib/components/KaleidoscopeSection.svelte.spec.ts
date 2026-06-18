import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import KaleidoscopeSection from './KaleidoscopeSection.svelte';
import {
	kaleidoscope,
	setKaleidoscopeEnabled,
	setCircularMask,
	setLiveTile,
	setTileBackground
} from '$lib/state/kaleidoscope.svelte';

describe('KaleidoscopeSection', () => {
	beforeEach(() => setKaleidoscopeEnabled(false));

	it('toggles kaleidoscope mode through the enable checkbox', async () => {
		render(KaleidoscopeSection);
		await userEvent.click(page.getByLabelText('Modalità caleidoscopio'));
		expect(kaleidoscope.enabled).toBe(true);
	});

	it('updates sectors from the range input', async () => {
		render(KaleidoscopeSection);
		await userEvent.fill(page.getByLabelText('Settori'), '12');
		expect(kaleidoscope.sectors).toBe(12);
	});

	// Each slider must route to its OWN setter — guards against copy-paste wiring bugs
	// across the structurally-identical control blocks.
	const rangeCases: ReadonlyArray<readonly [string, string, () => number]> = [
		['Ripetizioni', '5', () => kaleidoscope.repeat],
		['Distanza dal centro', '0.5', () => kaleidoscope.offsetDistance],
		['Scala globale', '2', () => kaleidoscope.scale],
		['Dimensione tessera', '1.5', () => kaleidoscope.tileSize],
		['Rotazione tessera', '90', () => kaleidoscope.tileRotation],
		['Rotazione tappeto', '45', () => kaleidoscope.carpetRotation],
		['Rotazione globale', '120', () => kaleidoscope.globalRotation]
	];

	for (const [label, value, get] of rangeCases) {
		it(`wires the "${label}" slider to its setter`, async () => {
			render(KaleidoscopeSection);
			await userEvent.fill(page.getByLabelText(label), value);
			expect(get()).toBe(Number(value));
		});
	}

	it('wires the circular-mask, live-tile and tile-background checkboxes', async () => {
		setCircularMask(true);
		setLiveTile(false);
		setTileBackground(false);
		render(KaleidoscopeSection);

		await userEvent.click(page.getByLabelText('Maschera circolare'));
		expect(kaleidoscope.circularMask).toBe(false);

		await userEvent.click(page.getByLabelText('Tessera viva'));
		expect(kaleidoscope.liveTile).toBe(true);

		await userEvent.click(page.getByLabelText('Sfondo tessera'));
		expect(kaleidoscope.tileBackground).toBe(true);
		expect(kaleidoscope.drawBackground).toBe(false);
	});

	it('shows "Aggiorna istantanea" only while the live tile is off', async () => {
		setLiveTile(false);
		render(KaleidoscopeSection);
		await expect.element(page.getByText('Aggiorna istantanea')).toBeInTheDocument();
	});

	it('shows the kaleidoscope background color input only when tile background is off', async () => {
		setTileBackground(false);
		render(KaleidoscopeSection);
		await expect.element(page.getByLabelText('Sfondo caleidoscopio')).toBeInTheDocument();
	});
});
