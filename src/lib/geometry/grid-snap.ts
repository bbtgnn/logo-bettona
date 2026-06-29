export type Pt = { x: number; y: number };
export type Grid = { left: number; top: number; stepX: number; stepY: number };

/** Nearest grid intersection to `p`. */
export function snapToGrid(p: Pt, g: Grid): Pt {
	return {
		x: g.left + Math.round((p.x - g.left) / g.stepX) * g.stepX,
		y: g.top + Math.round((p.y - g.top) / g.stepY) * g.stepY
	};
}

/** Constrain the vector (p - origin) to the nearest multiple of 45°, preserving its length. */
export function constrainTo45(origin: Pt, p: Pt): Pt {
	const dx = p.x - origin.x;
	const dy = p.y - origin.y;
	const len = Math.hypot(dx, dy);
	if (len === 0) return { x: origin.x, y: origin.y };
	const step = Math.PI / 4;
	const angle = Math.round(Math.atan2(dy, dx) / step) * step;
	return { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len };
}
