import { page, userEvent } from 'vitest/browser';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Path, PathLibraryEntry, Ring } from '$lib/types';
import { switchLocale } from '$lib/state/locale.svelte';
import { newRingId } from '$lib/state/ring-id';

// Keep RingPreview cheap and deterministic: stub the Paper.js pipeline so the
// per-target previews render a <canvas> without real geometry work.
vi.mock('$lib/geometry/render-pipeline', () => ({
	createRenderPipeline: () => ({ render: () => {}, dispose: () => {} })
}));

import ApplyToRingSheet from './ApplyToRingSheet.svelte';

const PATH: Path = { cmds: ['M', 'L', 'Z'], crds: [0, 0, 10, 0] };

function entry(): PathLibraryEntry {
	return {
		id: 'e1',
		name: 'Forma',
		createdAt: 1,
		path: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryPath: null
	};
}

function ring(): Ring {
	return {
		id: newRingId(),
		color: '#000',
		templatePath: { cmds: [...PATH.cmds], crds: [...PATH.crds] },
		secondaryTemplatePath: null,
		morphT: 0,
		ringHeight: 0.25
	};
}

describe('ApplyToRingSheet', () => {
	beforeEach(() => switchLocale('en'));

	it('lists one target per ring plus a new-ring target', async () => {
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring()], onapply: vi.fn() }
		});
		await expect.element(page.getByTestId('apply-target-existing-0')).toBeInTheDocument();
		await expect.element(page.getByTestId('apply-target-existing-1')).toBeInTheDocument();
		await expect.element(page.getByTestId('apply-target-new')).toBeInTheDocument();
	});

	it('confirm on an existing ring calls onapply with that index', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-existing-1'));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith({ kind: 'existing', index: 1 });
	});

	it('confirm on the new-ring target calls onapply with kind new', async () => {
		const onapply = vi.fn();
		render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-new'));
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).toHaveBeenCalledWith({ kind: 'new' });
	});

	it('does not apply when the selected ring index is out of range after rings shrink', async () => {
		const onapply = vi.fn();
		const { rerender } = render(ApplyToRingSheet, {
			props: { open: true, entry: entry(), rings: [ring(), ring(), ring()], onapply }
		});
		await userEvent.click(page.getByTestId('apply-target-existing-2'));
		await rerender({ open: true, entry: entry(), rings: [ring()], onapply });
		await userEvent.click(page.getByTestId('apply-confirm'));
		expect(onapply).not.toHaveBeenCalled();
	});
});
