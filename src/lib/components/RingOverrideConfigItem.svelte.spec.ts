import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import RingOverrideConfigItem from './RingOverrideConfigItem.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const preview = createRawSnippet(() => ({ render: () => `<p>preview marker</p>` }));

function open() {
	return userEvent.click(page.getByRole('button', { name: /Ring 1/ }));
}

describe('RingOverrideConfigItem', () => {
	beforeEach(() => switchLocale('en'));

	it('toggling the checkbox calls onToggle with the checked state', async () => {
		let toggled: boolean | null = null;
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: false,
			onToggle: (v: boolean) => (toggled = v),
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [],
			preview
		});
		await open();
		await userEvent.click(page.getByRole('checkbox'));
		expect(toggled).toBe(true);
	});

	it('hides sliders when hasOverride is false', async () => {
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: false,
			onToggle: () => {},
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [
				{ id: 's1', label: 'Slider one', min: 0, max: 1, step: 0.1, value: 0.5, oninput: () => {} }
			],
			preview
		});
		await open();
		expect(page.getByLabelText('Slider one').query()).toBeNull();
	});

	it('shows sliders when hasOverride is true and reports numeric input', async () => {
		let got: number | null = null;
		render(RingOverrideConfigItem, {
			index: 0,
			hasOverride: true,
			onToggle: () => {},
			overrideId: 'x-override-0',
			customizeLabel: 'Customize',
			sliders: [
				{
					id: 's1',
					label: 'Slider one',
					min: 0,
					max: 10,
					step: 1,
					value: 3,
					oninput: (v: number) => (got = v)
				}
			],
			preview
		});
		await open();
		const input = page.getByLabelText('Slider one');
		await expect.element(input).toBeInTheDocument();
		await userEvent.fill(input, '7');
		expect(got).toBe(7);
	});
});
