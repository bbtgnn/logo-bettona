import { test, expect } from '@playwright/test';

test('lands on Tracciati library and creates a custom curve', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	await expect(page).toHaveURL(/\/paths/);
	// base curves are seeded, listed and the canvas shows a preview
	await expect(page.getByTestId('tracciati-base-list')).toBeVisible();
	await expect(page.getByTestId('base-curve-builtin-0')).toBeVisible();
	await expect(page.getByTestId('tracciati-preview')).toBeVisible();

	// creating a custom curve adds a CustomCurveItem row
	await expect(page.locator('[data-testid^="custom-curve-"]')).toHaveCount(0);
	await page.getByTestId('tracciati-create').click();
	await expect(page.locator('[data-testid^="custom-curve-"]')).toHaveCount(1);
});
