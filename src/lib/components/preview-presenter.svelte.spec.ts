import { describe, it, expect } from 'vitest';
import { createPreviewPresenter } from './preview-presenter.svelte';

describe('createPreviewPresenter export surface', () => {
	it('exposes exportAnimation and a numeric progress getter', () => {
		const p = createPreviewPresenter();
		expect(typeof p.exportAnimation).toBe('function');
		expect(typeof p.exportProgress).toBe('number');
		expect(typeof p.animationExportSupported).toBe('boolean');
	});
});
