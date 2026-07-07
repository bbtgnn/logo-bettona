/** ISO 216 + US Letter paper presets. Millimetre dimensions are portrait (width < height). */
export type PrintFormatId = 'a5' | 'a4' | 'a3' | 'letter';
export type Orientation = 'portrait' | 'landscape';
export type PrintFormat = { id: PrintFormatId; label: string; widthMm: number; heightMm: number };

export const PRINT_FORMATS: PrintFormat[] = [
	{ id: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
	{ id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
	{ id: 'a3', label: 'A3', widthMm: 297, heightMm: 420 },
	{ id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 }
];

const BY_ID: Record<PrintFormatId, PrintFormat> = Object.fromEntries(
	PRINT_FORMATS.map((f) => [f.id, f])
) as Record<PrintFormatId, PrintFormat>;

/** Oriented paper dimensions in mm; landscape swaps width and height. */
export function orientedDimensionsMm(
	id: PrintFormatId,
	orientation: Orientation
): { widthMm: number; heightMm: number } {
	const f = BY_ID[id];
	return orientation === 'landscape'
		? { widthMm: f.heightMm, heightMm: f.widthMm }
		: { widthMm: f.widthMm, heightMm: f.heightMm };
}

/** Integer pixel size for the oriented paper at the given DPI: px = mm * dpi / 25.4. */
export function printFormatPixelSize(
	id: PrintFormatId,
	orientation: Orientation,
	dpi: number
): { width: number; height: number } {
	const { widthMm, heightMm } = orientedDimensionsMm(id, orientation);
	return {
		width: Math.round((widthMm * dpi) / 25.4),
		height: Math.round((heightMm * dpi) / 25.4)
	};
}
