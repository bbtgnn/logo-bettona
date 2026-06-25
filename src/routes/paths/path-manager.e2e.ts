import { test, expect } from '@playwright/test';

test('lands on Tracciati and uses a builtin curve to add a ring, then goes to the editor', async ({
	page
}) => {
	// Clear localStorage so the path library starts empty and builtins reseed deterministically
	// (rune-sync persists pathLibrary.entries there).
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	// `/` redirects to `/paths`, the new landing page for Tracciati.
	await expect(page).toHaveURL(/\/paths/);
	await expect(page.getByTestId('tracciati-grid')).toBeVisible();

	// "Vai all'editor" is disabled until at least one ring exists.
	await expect(page.getByTestId('tracciati-go-editor')).toBeDisabled();

	// Click a builtin curve card to open its popover, then "Usa" to add a ring from it.
	await page.getByTestId('curve-card-builtin-0').click();
	await expect(page.getByTestId('curve-use-builtin-0')).toBeVisible();
	await page.getByTestId('curve-use-builtin-0').click();

	// Still on Tracciati; the ring counter reflects the new ring and the editor link is enabled.
	await expect(page).toHaveURL(/\/paths/);
	await expect(page.getByTestId('tracciati-go-editor')).toBeEnabled();

	await page.getByTestId('tracciati-go-editor').click();
	await expect(page).toHaveURL(/\/editor/);
});
