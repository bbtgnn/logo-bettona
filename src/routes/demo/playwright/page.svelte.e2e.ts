import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page.locator('h1')).toBeVisible();
});

test('creates and removes ring morph target controls', async ({ page }) => {
	// Add a fresh ring in the Editor.
	await page.goto('/');
	await page.getByRole('button', { name: 'Add Ring' }).click();

	// Morph now lives in the Animate → Morph section, which is open by default.
	await page.goto('/animate');

	// Other layers (Audio Bars, Audio Zones) also render "Ring N" buttons, so scope
	// to the Morph section's own ring rows to find the last one and open it.
	const lastRingRow = page.locator('[data-testid^="ring-morph-config-"]').last();
	await lastRingRow.getByRole('button', { name: /^Ring \d+$/ }).click();
	await lastRingRow.getByRole('button', { name: 'Create morph target' }).click();
	await expect(lastRingRow.getByRole('button', { name: 'Remove morph target' })).toBeVisible();

	// Removing reverts the control.
	await lastRingRow.getByRole('button', { name: 'Remove morph target' }).click();
	await expect(lastRingRow.getByRole('button', { name: 'Create morph target' })).toBeVisible();
});
