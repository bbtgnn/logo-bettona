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
	size: number,
	canvasWidth: number = size,
	canvasHeight: number = size
): void {
	const sectors = clampSectors(params.sectors);
	const wedge = wedgeAngle(sectors);
	// Center the kaleidoscope in the (possibly non-square) canvas; `size` is only its
	// diameter. Without this the disc sits in the top-left size×size square.
	const cx = canvasWidth / 2;
	const cy = canvasHeight / 2;
	const maxSide = Math.max(tileW, tileH) || 1;
	const drawW = size * params.tileSize * (tileW / maxSide);
	const drawH = size * params.tileSize * (tileH / maxSide);
	const offsetPx = params.offsetDistance * size;
	const clipRadius = size * 1.5;

	ctx.clearRect(0, 0, canvasWidth, canvasHeight);
	if (params.drawBackground) {
		ctx.fillStyle = params.backgroundColor;
		ctx.fillRect(0, 0, canvasWidth, canvasHeight);
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

// Minimal escaping for values interpolated into SVG attribute strings. Current
// callers feed a color-input value, but this hardens against a malformed string.
function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function extractSvgParts(svg: string): { inner: string; viewBox: string } {
	const innerMatch = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i);
	const inner = innerMatch && innerMatch[1] ? innerMatch[1].trim() : '';
	const vbMatch = svg.match(/viewBox="([^"]+)"/);
	let viewBox = vbMatch ? vbMatch[1] : '';
	if (!viewBox) {
		const w = svg.match(/width="([\d.]+)"/);
		const h = svg.match(/height="([\d.]+)"/);
		viewBox = `0 0 ${w ? w[1] : 100} ${h ? h[1] : 100}`;
	}
	return { inner, viewBox };
}

export function generateKaleidoscopeSVG(
	tileSvg: string,
	params: KaleidoscopeParams,
	size: number
): string {
	const { inner, viewBox } = extractSvgParts(tileSvg);
	// viewBox values may be separated by any whitespace and/or commas (both SVG-valid).
	const [, , vbWStr, vbHStr] = viewBox.trim().split(/[\s,]+/);
	const vbW = Number(vbWStr) || 1;
	const vbH = Number(vbHStr) || 1;
	const sectors = clampSectors(params.sectors);
	const wedgeDeg = 360 / sectors;
	const wedgeRad = wedgeAngle(sectors);
	const cx = size / 2;
	const cy = size / 2;
	const maxSide = Math.max(vbW, vbH) || 1;
	const drawW = size * params.tileSize * (vbW / maxSide);
	const drawH = size * params.tileSize * (vbH / maxSide);
	const offsetPx = params.offsetDistance * size;
	const clipR = size * 1.5;
	const f = (n: number) => n.toFixed(4);

	// Wedge clip path (centered at origin, the per-sector group translates to center).
	const x0 = clipR * Math.cos(-wedgeRad / 2);
	const y0 = clipR * Math.sin(-wedgeRad / 2);
	const x1 = clipR * Math.cos(wedgeRad / 2);
	const y1 = clipR * Math.sin(wedgeRad / 2);
	const largeArc = wedgeRad > Math.PI ? 1 : 0;

	const offsets = carpetTileOffsets(params.repeat, drawW, drawH);
	const carpet = offsets
		.map((off) => {
			const rot = params.carpetRotation ? ` rotate(${f(params.carpetRotation)})` : '';
			return (
				`<g transform="translate(${f(off.x)},${f(off.y)})${rot}">` +
				`<use href="#kaleido-tile" x="${f(-drawW / 2)}" y="${f(-drawH / 2)}" width="${f(drawW)}" height="${f(drawH)}"/>` +
				`</g>`
			);
		})
		.join('');

	let sectorsSvg = '';
	for (let i = 0; i < sectors; i++) {
		const mirror = isSectorMirrored(i) ? '<g transform="scale(-1,1)">' : '<g>';
		sectorsSvg +=
			`<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(i * wedgeDeg)})">` +
			`<g clip-path="url(#kaleido-wedge)">` +
			mirror +
			`<g transform="translate(${f(offsetPx)},0) rotate(${f(params.tileRotation)}) scale(${f(params.scale)})">` +
			carpet +
			`</g></g></g></g>`;
	}

	const defs =
		`<defs>` +
		`<symbol id="kaleido-tile" viewBox="${viewBox}" overflow="visible">${inner}</symbol>` +
		`<clipPath id="kaleido-wedge"><path d="M 0,0 L ${f(x0)},${f(y0)} A ${f(clipR)},${f(clipR)} 0 ${largeArc} 1 ${f(x1)},${f(y1)} Z"/></clipPath>` +
		(params.circularMask
			? `<clipPath id="kaleido-outer"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(size / 2)}"/></clipPath>`
			: '') +
		`</defs>`;

	const bg = params.drawBackground
		? `<rect width="${size}" height="${size}" fill="${escapeAttr(params.backgroundColor)}"/>`
		: '';

	const globalOpen = params.globalRotation
		? `<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(params.globalRotation)}) translate(${f(-cx)},${f(-cy)})">`
		: '<g>';
	const maskOpen = params.circularMask ? '<g clip-path="url(#kaleido-outer)">' : '<g>';

	return (
		`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">` +
		defs +
		bg +
		globalOpen +
		maskOpen +
		sectorsSvg +
		`</g></g></svg>`
	);
}
