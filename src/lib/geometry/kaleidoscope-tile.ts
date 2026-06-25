/**
 * Returns a tile canvas with an opaque background painted behind the source shapes.
 * When `backgroundColor` is null the source is returned unchanged (transparent tile).
 */
export function composeTileWithBackground(
	source: HTMLCanvasElement,
	backgroundColor: string | null
): HTMLCanvasElement {
	if (backgroundColor === null) return source;
	const out = document.createElement('canvas');
	out.width = source.width;
	out.height = source.height;
	const ctx = out.getContext('2d');
	if (!ctx) return source;
	ctx.fillStyle = backgroundColor;
	ctx.fillRect(0, 0, out.width, out.height);
	ctx.drawImage(source, 0, 0);
	return out;
}
