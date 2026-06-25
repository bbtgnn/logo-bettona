import { test, expect } from '@playwright/test';

test('save a ring path then load it back via the library', async ({ page }) => {
	// Clear localStorage so the library starts empty (rune-sync persists there).
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();

	// Open the sidebar if it is collapsed (SidebarTrigger toggles it).
	// The shadcn SidebarTrigger is the only button inside the header without a visible label.
	// We try to reach Ring 1 first; if not visible, open the sidebar.
	const ringTrigger = page.getByRole('button', { name: /Ring 1/ });
	if (!(await ringTrigger.isVisible())) {
		await page
			.getByTestId('sidebar-content')
			.waitFor({ state: 'visible', timeout: 3000 })
			.catch(() => {
				// sidebar may be closed — open it
			});
		const sidebarVisible = await page.getByTestId('sidebar-content').isVisible();
		if (!sidebarVisible) {
			// Click the SidebarTrigger (first button in the header area)
			await page.locator('header button').first().click();
		}
	}

	// Expand Ring 1 in the sidebar (the CollapsibleTrigger for the first ring).
	await ringTrigger.click();

	// Save current path to library.
	await page.getByTestId('ring-save-to-library-0').click();
	await expect(page.getByTestId('ring-save-status-0')).toContainText(/Saved as 'Path 1'/);

	// Navigate to /paths and verify one entry.
	await page.getByTestId('nav-paths').click();
	await expect(page).toHaveURL(/\/paths$/);
	await expect(page.locator('[data-testid^="paths-card-"]')).toHaveCount(1);

	// Apply the saved shape onto a ring from Paths (select card → Apply → confirm).
	await page.locator('[data-testid^="paths-card-"]').first().click();
	await page.getByTestId('paths-apply').click();
	await page.getByTestId('apply-confirm').click();
	await expect(page.getByRole('heading', { name: 'Apply to mark' })).toBeHidden({
		timeout: 2000
	});

	// Go back to the editor.
	await page.getByTestId('nav-editor').click();
	await expect(page).toHaveURL(/\/editor$/);

	// Ensure Ring 1 is expanded (open it only if the save button is not visible).
	const saveBtn = page.getByTestId('ring-save-to-library-0');
	if (!(await saveBtn.isVisible())) {
		await ringTrigger.click();
	}
	await page.getByTestId('ring-load-from-library-0').click();

	// Select the first entry in the picker grid.
	await page.locator('[data-testid^="library-picker-entry-"]').first().click();

	// Confirm (sheet switches to slot-picker view, then Applica).
	await page.getByTestId('library-picker-confirm').click();

	// The sheet should close — assert via the sheet title heading.
	await expect(page.getByRole('heading', { name: 'Load from library' })).toBeHidden({
		timeout: 2000
	});
});
