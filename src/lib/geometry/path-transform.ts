import type { Path } from '$lib/types';

function bboxCenter(crds: number[]): { cx: number; cy: number } {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i + 1 < crds.length; i += 2) {
		minX = Math.min(minX, crds[i]);
		maxX = Math.max(maxX, crds[i]);
		minY = Math.min(minY, crds[i + 1]);
		maxY = Math.max(maxY, crds[i + 1]);
	}
	return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Scales every (x,y) pair around the path's bounding-box center. Pure. */
export function scalePath(path: Path, sx: number, sy: number): Path {
	const { cx, cy } = bboxCenter(path.crds);
	const crds = path.crds.map((v, i) =>
		i % 2 === 0 ? cx + (v - cx) * sx : cy + (v - cy) * sy
	);
	return { cmds: [...path.cmds], crds };
}

/** Horizontal mirror around the bounding-box center. Pure. */
export function mirrorX(path: Path): Path {
	return scalePath(path, -1, 1);
}
