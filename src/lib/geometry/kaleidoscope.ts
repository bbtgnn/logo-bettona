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

export function renderKaleidoscopeToCanvas(
	ctx: CanvasRenderingContext2D,
	tile: CanvasImageSource,
	tileW: number,
	tileH: number,
	params: KaleidoscopeParams,
	size: number
): void {
	const sectors = clampSectors(params.sectors);
	const wedge = wedgeAngle(sectors);
	const cx = size / 2;
	const cy = size / 2;
	const maxSide = Math.max(tileW, tileH) || 1;
	const drawW = size * params.tileSize * (tileW / maxSide);
	const drawH = size * params.tileSize * (tileH / maxSide);
	const offsetPx = params.offsetDistance * size;
	const clipRadius = size * 1.5;

	ctx.clearRect(0, 0, size, size);
	if (params.drawBackground) {
		ctx.fillStyle = params.backgroundColor;
		ctx.fillRect(0, 0, size, size);
	}

	ctx.save();
	if (params.globalRotation) {
		ctx.translate(cx, cy);
		ctx.rotate(degToRad(params.globalRotation));
		ctx.translate(-cx, -cy);
	}

	const offsets = carpetTileOffsets(params.repeat, drawW, drawH);

	for (let i = 0; i < sectors; i++) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate(i * wedge);

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, clipRadius, -wedge / 2, wedge / 2);
		ctx.closePath();
		ctx.clip();

		if (isSectorMirrored(i)) ctx.scale(-1, 1);
		ctx.translate(offsetPx, 0);
		ctx.rotate(degToRad(params.tileRotation));
		ctx.scale(params.scale, params.scale);

		for (const off of offsets) {
			ctx.save();
			ctx.translate(off.x, off.y);
			if (params.carpetRotation) ctx.rotate(degToRad(params.carpetRotation));
			ctx.drawImage(tile, -drawW / 2, -drawH / 2, drawW, drawH);
			ctx.restore();
		}

		ctx.restore();
	}

	ctx.restore();

	if (params.circularMask) {
		ctx.save();
		ctx.globalCompositeOperation = 'destination-in';
		ctx.beginPath();
		ctx.arc(cx, cy, size / 2, 0, 2 * Math.PI);
		ctx.closePath();
		ctx.fillStyle = '#000000';
		ctx.fill();
		ctx.restore();
	}
}
