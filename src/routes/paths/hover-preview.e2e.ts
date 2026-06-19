import { test, expect } from '@playwright/test';

test('hovering a library card shows a ring preview popover', async ({ page }) => {
	// Clear localStorage so we control library contents.
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	// Save the first ring's path to the library so /paths has one card.
	const ringTrigger = page.getByRole('button', { name: /Ring 1/ });
	if (!(await ringTrigger.isVisible())) {
		await page.locator('header button').first().click();
	}
	await ringTrigger.click();
	await page.getByTestId('ring-save-to-library-0').click();
	await expect(page.getByTestId('ring-save-status-0')).toContainText(/Salvato come 'Path 1'/);

	// Navigate to /paths.
	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);

	const firstCard = page.getByTestId('paths-grid').locator('li').first();
	await expect(firstCard).toBeVisible();

	// Popover should not be visible before hover.
	await expect(firstCard.getByTestId('path-preview-popover')).toBeHidden();

	// Hover the card → popover with a canvas appears.
	await firstCard.hover();
	await page.waitForTimeout(100);
	const popover = firstCard.getByTestId('path-preview-popover');
	await expect(popover).toBeVisible({ timeout: 2000 });
	await expect(popover.getByTestId('ring-preview-canvas')).toBeVisible();

	// Move mouse away → popover hides.
	await page.mouse.move(10, 10);
	await expect(popover).toBeHidden({ timeout: 2000 });
});
