import { expect, test } from '@playwright/test';

test('navigates between editor and About via header links', async ({ page }) => {
	await page.goto('/');

	await page.getByTestId('header-about-link').click();
	await expect(page).toHaveURL(/\/about$/);
	await expect(page.locator('h1')).toBeVisible();

	await page.getByTestId('about-back-link').click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByText('Shape Editor')).toBeVisible();
});
