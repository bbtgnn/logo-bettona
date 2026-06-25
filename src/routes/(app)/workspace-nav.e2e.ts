import { expect, test } from '@playwright/test';

test('tabs navigate between Editor, Animate and Paths', async ({ page }) => {
	await page.goto('/editor');
	await expect(page.getByTestId('nav-editor')).toHaveAttribute('aria-current', 'page');

	await page.getByTestId('nav-animate').click();
	await expect(page).toHaveURL(/\/animate$/);
	await expect(page.getByTestId('nav-animate')).toHaveAttribute('aria-current', 'page');

	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);
});

test('root redirects to /paths', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/paths$/);
});
