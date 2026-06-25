/**
 * Uniform scale to fit `bounds` into `viewSize` minus `padding` on every side.
 * Returns null when there is nothing to fit — a degenerate bound (zero width or
 * height) or a view with no available space after padding. Pure: the caller
 * applies the scale to a paper layer (see fitPreviewToView).
 */
export function computeFitToView(
	bounds: { width: number; height: number },
	viewSize: { width: number; height: number },
	padding: number
): number | null {
	if (bounds.width === 0 || bounds.height === 0) return null;
	const available = Math.min(viewSize.width, viewSize.height) - padding * 2;
	if (available <= 0) return null;
	return available / Math.max(bounds.width, bounds.height);
}
