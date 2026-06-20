import type { ColorMode, FullPalette, MonochromePalette } from '$lib/types';

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function parseHexColors(input: string): string[] {
	const candidates = input.split(',').map((s) => s.trim());
	const valid = candidates.filter((c) => HEX_RE.test(c));
	return valid.length > 0 ? valid : ['#000000', '#ffffff'];
}

export function applyMonochrome(palette: MonochromePalette, ringCount: number): string[] {
	const result: string[] = new Array(ringCount);
	for (let i = 0; i < ringCount; i++) {
		// outermost = last index = primary; alternate inward to secondary
		const distFromOuter = ringCount - 1 - i;
		result[i] = distFromOuter % 2 === 0 ? palette.primary : palette.secondary;
	}
	return result;
}

export function applyPalette(palette: FullPalette, ringCount: number): string[] {
	const colors = palette.colors;
	if (colors.length === 0) return new Array(ringCount).fill('#000000');
	if (colors.length === 1) return new Array(ringCount).fill(colors[0]);

	const result: string[] = [];
	for (let i = 0; i < ringCount; i++) {
		const prev = result[i - 1];
		const available = colors.filter((c) => c !== prev);
		const pick = available[Math.floor(Math.random() * available.length)];
		result.push(pick);
	}
	return result;
}

export function applyColors(
	mode: ColorMode,
	monochromePalette: MonochromePalette | undefined,
	fullPalette: FullPalette | undefined,
	currentColors: string[],
	ringCount: number
): string[] {
	if (ringCount === 0) return [];

	switch (mode) {
		case 'monochrome':
			return applyMonochrome(
				monochromePalette ?? { primary: '#000000', secondary: '#ffffff', background: '#ffffff' },
				ringCount
			);
		case 'palette':
			return applyPalette(
				fullPalette ?? { colors: ['#000000', '#ffffff'] },
				ringCount
			);
		case 'manual':
			return [...currentColors];
	}
}
