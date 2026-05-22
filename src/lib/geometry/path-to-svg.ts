import type { Path } from '$lib/types';

const ARITY: Record<Path['cmds'][number], number> = {
	M: 2,
	L: 2,
	Q: 4,
	C: 6,
	Z: 0
};

export function pathToSvgD(path: Path): string {
	const expected = path.cmds.reduce((sum, c) => sum + ARITY[c], 0);
	if (expected !== path.crds.length) {
		throw new Error(`Path arity mismatch: cmds expect ${expected} coords, got ${path.crds.length}`);
	}
	const out: string[] = [];
	let i = 0;
	for (const cmd of path.cmds) {
		const n = ARITY[cmd];
		const coords = path.crds.slice(i, i + n);
		i += n;
		out.push(n === 0 ? cmd : `${cmd} ${coords.join(' ')}`);
	}
	return out.join(' ');
}

export function pathBoundingBox(path: Path): { x: number; y: number; w: number; h: number } {
	if (path.crds.length % 2 !== 0) {
		throw new Error(`Path crds length must be even, got ${path.crds.length}`);
	}
	if (path.crds.length === 0) {
		return { x: 0, y: 0, w: 0, h: 0 };
	}
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < path.crds.length; i += 2) {
		const x = path.crds[i];
		const y = path.crds[i + 1];
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
