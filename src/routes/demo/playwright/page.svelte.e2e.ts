import { expect, test } from '@playwright/test';

test('has expected h1', async ({ page }) => {
	await page.goto('/demo/playwright');
	await expect(page.locator('h1')).toBeVisible();
});

test('creates and removes ring morph target controls', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add Ring' }).click();
	await page.getByRole('button', { name: 'Ring 1' }).click();
	await page.getByRole('button', { name: 'Create morph target' }).click();
	await expect(page.getByText(/Morph t:/)).toBeVisible();

	await page.getByRole('button', { name: 'Remove morph target' }).click();
	await expect(page.getByText(/Morph t:/)).toHaveCount(0);
});
