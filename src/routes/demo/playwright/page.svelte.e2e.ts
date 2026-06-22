import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page.locator('h1')).toBeVisible();
});

test('creates and removes ring morph target controls', async ({ page }) => {
	await page.goto('/');

	// Add a fresh ring (the default rings already ship with morph targets) and expand it.
	await page.getByRole('button', { name: 'Add Ring' }).click();
	await page
		.getByRole('button', { name: /^Ring \d+$/ })
		.last()
		.click();

	// Creating the morph target swaps the Create control for Remove.
	await page.getByRole('button', { name: 'Create morph target' }).click();
	await expect(page.getByRole('button', { name: 'Remove morph target' })).toBeVisible();

	// The per-ring morphT slider + "Morph t:" readout no longer live in the editor —
	// they moved to the Simple window of the animate workspace (covered by the
	// SimpleSection unit test). The editor keeps only the morph-target draw controls.
	await expect(page.getByText(/Morph t:/)).toHaveCount(0);

	// Removing the morph target reverts the control.
	await page.getByRole('button', { name: 'Remove morph target' }).click();
	await expect(page.getByRole('button', { name: 'Create morph target' })).toBeVisible();
});
