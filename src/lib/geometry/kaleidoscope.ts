export type KaleidoscopeParams = {
	sectors: number;
	repeat: number;
	offsetDistance: number; // fraction of canvas size (0..1)
	scale: number; // unitless multiplier
	tileSize: number; // unitless multiplier (tile size relative to canvas)
	tileRotation: number; // degrees
	carpetRotation: number; // degrees
	globalRotation: number; // degrees
	circularMask: boolean;
	backgroundColor: string;
	drawBackground: boolean;
};

export type TileOffset = { x: number; y: number };

export function clampSectors(n: number): number {
	const v = Number.isFinite(n) ? Math.round(n) : 4;
	const even = v % 2 === 0 ? v : v - 1;
	return Math.max(4, Math.min(24, even));
}

export function clampRepeat(n: number): number {
	const v = Number.isFinite(n) ? Math.floor(n) : 1;
	return Math.max(1, Math.min(10, v));
}

export function wedgeAngle(sectors: number): number {
	return (2 * Math.PI) / clampSectors(sectors);
}

export function isSectorMirrored(index: number): boolean {
	return index % 2 === 0;
}

export function degToRad(deg: number): number {
	return (deg * Math.PI) / 180;
}

export function carpetTileOffsets(repeat: number, tileW: number, tileH: number): TileOffset[] {
	const r = clampRepeat(repeat);
	const offsets: TileOffset[] = [];
	for (let row = 0; row < r; row++) {
		for (let col = 0; col < r; col++) {
			offsets.push({
				x: (col - (r - 1) / 2) * tileW,
				y: (row - (r - 1) / 2) * tileH
			});
		}
	}
	return offsets;
}
