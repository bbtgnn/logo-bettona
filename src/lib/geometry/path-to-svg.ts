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
		throw new Error(
			`Path arity mismatch: cmds expect ${expected} coords, got ${path.crds.length}`
		);
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
