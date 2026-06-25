import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { createRawSnippet } from 'svelte';
import RingConfigShell from './RingConfigShell.svelte';
import { switchLocale } from '$lib/state/locale.svelte';

const body = createRawSnippet(() => ({ render: () => `<p>body marker</p>` }));

describe('RingConfigShell', () => {
	beforeEach(() => switchLocale('en'));

	it('shows the ring label, renders content, and toggles open on trigger click', async () => {
		render(RingConfigShell, { index: 0, content: body });
		await expect.element(page.getByText('Ring 1')).toBeInTheDocument();
		await expect.element(page.getByText('body marker')).toBeInTheDocument();
		const trigger = page.getByRole('button', { name: /Ring 1/ });
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'false');
		await userEvent.click(trigger);
		await expect.element(trigger).toHaveAttribute('aria-expanded', 'true');
	});

	it('renders the custom badge only when badge is true', async () => {
		render(RingConfigShell, { index: 1, badge: true, content: body });
		await expect.element(page.getByText('(custom)')).toBeInTheDocument();
	});

	it('applies the testid to the wrapper when provided', async () => {
		render(RingConfigShell, { index: 2, testid: 'ring-x-config-2', content: body });
		expect(page.getByTestId('ring-x-config-2').query()).not.toBeNull();
	});
});
