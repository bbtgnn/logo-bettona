import { expect, test } from '@playwright/test';

test('navigates to About from the workspace and back', async ({ page }) => {
	await page.goto('/editor');

	await page.getByTestId('header-about-link').click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.locator('h1')).toBeVisible();

	await page.getByTestId('about-back-link').click();
	await expect(page).toHaveURL(/\/editor$/);
});
