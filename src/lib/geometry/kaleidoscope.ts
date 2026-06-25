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

/** Output frame in pixels; the disc diameter is the shorter side. */
export type KaleidoscopeFrame = { width: number; height: number };
/** Intrinsic size of the source tile — bitmap pixels (canvas) or viewBox units (SVG). */
export type TileAspect = { width: number; height: number };

/**
 * Everything a renderer must know to paint the kaleidoscope, computed once so the
 * canvas and SVG adapters can never drift on the geometry. Rotations are kept in the
 * unit each adapter consumes most naturally: sector rotation in radians (canvas arc),
 * tile/carpet/global rotation in degrees (the params' own unit). Adapters only emit
 * primitives from these numbers — they do no geometry of their own.
 */
export type KaleidoscopeLayout = {
	width: number;
	height: number;
	background: string | null;
	globalRotationDeg: number;
	center: { x: number; y: number };
	wedgeAngleRad: number;
	clipRadius: number;
	sectors: { rotationRad: number; mirror: boolean }[];
	inner: { offsetPx: number; tileRotationDeg: number; scale: number };
	tile: { drawW: number; drawH: number };
	carpet: TileOffset[];
	carpetRotationDeg: number;
	circularMask: { x: number; y: number; r: number } | null;
};

export function kaleidoscopeLayout(
	params: KaleidoscopeParams,
	frame: KaleidoscopeFrame,
	tile: TileAspect
): KaleidoscopeLayout {
	const sectorCount = clampSectors(params.sectors);
	const wedge = wedgeAngle(sectorCount);
	// The disc fills the shorter side; it is centered in the (possibly non-square) frame
	// so the export matches the on-screen render instead of cropping to a square.
	const size = Math.min(frame.width, frame.height);
	const cx = frame.width / 2;
	const cy = frame.height / 2;
	const maxSide = Math.max(tile.width, tile.height) || 1;
	const drawW = size * params.tileSize * (tile.width / maxSide);
	const drawH = size * params.tileSize * (tile.height / maxSide);

	const sectors = [];
	for (let i = 0; i < sectorCount; i++) {
		sectors.push({ rotationRad: i * wedge, mirror: isSectorMirrored(i) });
	}

	return {
		width: frame.width,
		height: frame.height,
		background: params.drawBackground ? params.backgroundColor : null,
		globalRotationDeg: params.globalRotation,
		center: { x: cx, y: cy },
		wedgeAngleRad: wedge,
		clipRadius: size * 1.5,
		sectors,
		inner: { offsetPx: params.offsetDistance * size, tileRotationDeg: params.tileRotation, scale: params.scale },
		tile: { drawW, drawH },
		carpet: carpetTileOffsets(params.repeat, drawW, drawH),
		carpetRotationDeg: params.carpetRotation,
		circularMask: params.circularMask ? { x: cx, y: cy, r: size / 2 } : null
	};
}

export function renderKaleidoscopeToCanvas(
	ctx: CanvasRenderingContext2D,
	tile: CanvasImageSource,
	tileW: number,
	tileH: number,
	params: KaleidoscopeParams,
	frame: KaleidoscopeFrame
): void {
	const layout = kaleidoscopeLayout(params, frame, { width: tileW, height: tileH });
	const { center, wedgeAngleRad: wedge, clipRadius, inner, tile: tileBox } = layout;
	const { drawW, drawH } = tileBox;

	ctx.clearRect(0, 0, layout.width, layout.height);
	if (layout.background !== null) {
		ctx.fillStyle = layout.background;
		ctx.fillRect(0, 0, layout.width, layout.height);
	}

	ctx.save();
	if (layout.globalRotationDeg) {
		ctx.translate(center.x, center.y);
		ctx.rotate(degToRad(layout.globalRotationDeg));
		ctx.translate(-center.x, -center.y);
	}

	for (const sector of layout.sectors) {
		ctx.save();
		ctx.translate(center.x, center.y);
		ctx.rotate(sector.rotationRad);

		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.arc(0, 0, clipRadius, -wedge / 2, wedge / 2);
		ctx.closePath();
		ctx.clip();

		if (sector.mirror) ctx.scale(-1, 1);
		ctx.translate(inner.offsetPx, 0);
		ctx.rotate(degToRad(inner.tileRotationDeg));
		ctx.scale(inner.scale, inner.scale);

		for (const off of layout.carpet) {
			ctx.save();
			ctx.translate(off.x, off.y);
			if (layout.carpetRotationDeg) ctx.rotate(degToRad(layout.carpetRotationDeg));
			ctx.drawImage(tile, -drawW / 2, -drawH / 2, drawW, drawH);
			ctx.restore();
		}

		ctx.restore();
	}

	ctx.restore();

	if (layout.circularMask) {
		ctx.save();
		ctx.globalCompositeOperation = 'destination-in';
		ctx.beginPath();
		ctx.arc(layout.circularMask.x, layout.circularMask.y, layout.circularMask.r, 0, 2 * Math.PI);
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
	frame: KaleidoscopeFrame
): string {
	const { inner, viewBox } = extractSvgParts(tileSvg);
	// viewBox values may be separated by any whitespace and/or commas (both SVG-valid).
	const [, , vbWStr, vbHStr] = viewBox.trim().split(/[\s,]+/);
	const vbW = Number(vbWStr) || 1;
	const vbH = Number(vbHStr) || 1;
	const layout = kaleidoscopeLayout(params, frame, { width: vbW, height: vbH });
	const { center, clipRadius: clipR, inner: innerBox, tile: tileBox } = layout;
	const { drawW, drawH } = tileBox;
	const cx = center.x;
	const cy = center.y;
	const wedgeRad = layout.wedgeAngleRad;
	const radToDeg = (rad: number) => (rad * 180) / Math.PI;
	const f = (n: number) => n.toFixed(4);

	// Wedge clip path (centered at origin, the per-sector group translates to center).
	const x0 = clipR * Math.cos(-wedgeRad / 2);
	const y0 = clipR * Math.sin(-wedgeRad / 2);
	const x1 = clipR * Math.cos(wedgeRad / 2);
	const y1 = clipR * Math.sin(wedgeRad / 2);
	const largeArc = wedgeRad > Math.PI ? 1 : 0;

	const carpet = layout.carpet
		.map((off) => {
			const rot = layout.carpetRotationDeg ? ` rotate(${f(layout.carpetRotationDeg)})` : '';
			return (
				`<g transform="translate(${f(off.x)},${f(off.y)})${rot}">` +
				`<use href="#kaleido-tile" x="${f(-drawW / 2)}" y="${f(-drawH / 2)}" width="${f(drawW)}" height="${f(drawH)}"/>` +
				`</g>`
			);
		})
		.join('');

	let sectorsSvg = '';
	for (const sector of layout.sectors) {
		const mirror = sector.mirror ? '<g transform="scale(-1,1)">' : '<g>';
		sectorsSvg +=
			`<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(radToDeg(sector.rotationRad))})">` +
			`<g clip-path="url(#kaleido-wedge)">` +
			mirror +
			`<g transform="translate(${f(innerBox.offsetPx)},0) rotate(${f(innerBox.tileRotationDeg)}) scale(${f(innerBox.scale)})">` +
			carpet +
			`</g></g></g></g>`;
	}

	const defs =
		`<defs>` +
		`<symbol id="kaleido-tile" viewBox="${viewBox}" overflow="visible">${inner}</symbol>` +
		`<clipPath id="kaleido-wedge"><path d="M 0,0 L ${f(x0)},${f(y0)} A ${f(clipR)},${f(clipR)} 0 ${largeArc} 1 ${f(x1)},${f(y1)} Z"/></clipPath>` +
		(layout.circularMask
			? `<clipPath id="kaleido-outer"><circle cx="${f(layout.circularMask.x)}" cy="${f(layout.circularMask.y)}" r="${f(layout.circularMask.r)}"/></clipPath>`
			: '') +
		`</defs>`;

	const bg = layout.background
		? `<rect width="${layout.width}" height="${layout.height}" fill="${escapeAttr(layout.background)}"/>`
		: '';

	const globalOpen = layout.globalRotationDeg
		? `<g transform="translate(${f(cx)},${f(cy)}) rotate(${f(layout.globalRotationDeg)}) translate(${f(-cx)},${f(-cy)})">`
		: '<g>';
	const maskOpen = layout.circularMask ? '<g clip-path="url(#kaleido-outer)">' : '<g>';

	return (
		`<svg width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg">` +
		defs +
		bg +
		globalOpen +
		maskOpen +
		sectorsSvg +
		`</g></g></svg>`
	);
}
