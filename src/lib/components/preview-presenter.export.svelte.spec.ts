import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createPreviewPresenter } from './preview-presenter.svelte';
import { composition, setAspectRatio } from '$lib/state/composition';
import { setKaleidoscopeEnabled } from '$lib/state/kaleidoscope.svelte';

// Capture downloads: PNG sets anchor.href to a data: URL; SVG sets it to a blob: URL
// created from a Blob we capture via URL.createObjectURL.
function withCapturedDownloads(fn: (caught: { href: string; name: string }[], blobs: Blob[]) => Promise<void>) {
	const caught: { href: string; name: string }[] = [];
	const blobs: Blob[] = [];
	const origClick = HTMLAnchorElement.prototype.click;
	const origCreate = URL.createObjectURL;
	HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
		caught.push({ href: this.href, name: this.download });
	};
	URL.createObjectURL = ((b: Blob) => {
		blobs.push(b);
		return 'blob:mock';
	}) as typeof URL.createObjectURL;
	return Promise.resolve(fn(caught, blobs)).finally(() => {
		HTMLAnchorElement.prototype.click = origClick;
		URL.createObjectURL = origCreate;
	});
}

function mountPresenter() {
	const canvas = document.createElement('canvas');
	canvas.width = 600;
	canvas.height = 600;
	document.body.appendChild(canvas);
	const presenter = createPreviewPresenter();
	// attach() wires Svelte $effects, which require a component/effect-root context.
	// $effect.root gives it one outside an actual component tree.
	let detach: (() => void) | undefined;
	const disposeRoot = $effect.root(() => {
		detach = presenter.attach(canvas);
	});
	flushSync();
	const cleanup = () => {
		detach?.();
		disposeRoot();
		canvas.remove();
	};
	return { presenter, canvas, cleanup };
}

async function dataUrlSize(dataUrl: string): Promise<{ w: number; h: number }> {
	const img = new Image();
	await new Promise((res, rej) => {
		img.onload = res;
		img.onerror = rej;
		img.src = dataUrl;
	});
	return { w: img.naturalWidth, h: img.naturalHeight };
}

describe('preview-presenter export', () => {
	beforeEach(() => {
		setAspectRatio('1:1');
		composition.rings = [
			{
				id: 'test-ring',
				color: '#000000',
				templatePath: { cmds: ['M', 'L', 'L', 'L', 'Z'], crds: [0, 0, 100, 0, 100, 50, 0, 50] },
				secondaryTemplatePath: null,
				morphT: 0,
				ringHeight: 0.25
			}
		];
	});
	afterEach(() => {
		setKaleidoscopeEnabled(false);
		setAspectRatio('1:1');
	});

	it('exports a PNG named composition.png in flat mode', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (caught) => {
			presenter.exportPng({ includeBackground: true, scale: 1 });
			expect(caught.some((c) => c.name === 'composition.png')).toBe(true);
		});
		cleanup();
	});

	it('PNG resolution scale changes the exported pixel dimensions', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (caught) => {
			presenter.exportPng({ includeBackground: true, scale: 2 });
			const png = caught.find((c) => c.name === 'composition.png')!;
			const { w, h } = await dataUrlSize(png.href);
			expect(Math.max(w, h)).toBe(1200); // 600 long side × 2
		});
		cleanup();
	});

	it('exportPng honors an explicit size', async () => {
		const { presenter, cleanup } = mountPresenter();
		try {
			await withCapturedDownloads(async (caught) => {
				presenter.exportPng({ includeBackground: true, size: { width: 800, height: 1000 } });
				const png = caught.find((c) => c.name === 'composition.png');
				expect(png).toBeDefined();
				const { w, h } = await dataUrlSize(png!.href);
				expect(w).toBe(800);
				expect(h).toBe(1000);
			});
		} finally {
			cleanup();
		}
	});

	it('flat SVG with background off omits the preview-background rect', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (_caught, blobs) => {
			presenter.exportSvg({ includeBackground: false });
			const text = await blobs[blobs.length - 1].text();
			expect(text).not.toContain('preview-background');
		});
		cleanup();
	});

	it('flat SVG with background on keeps the preview-background rect', async () => {
		const { presenter, cleanup } = mountPresenter();
		await withCapturedDownloads(async (_caught, blobs) => {
			presenter.exportSvg({ includeBackground: true });
			const text = await blobs[blobs.length - 1].text();
			expect(text).toContain('preview-background');
		});
		cleanup();
	});
});
