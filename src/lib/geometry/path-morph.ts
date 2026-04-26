import type { Path } from '$lib/types';

export class PathMorphError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PathMorphError';
	}
}

export type PathCompatibilityResult = { ok: true } | { ok: false; reason: string };

const COMMAND_MISMATCH_REASON = 'Path commands must match exactly to interpolate';
const COORDINATE_MISMATCH_REASON = 'Path coordinates must have the same length to interpolate';

export function validatePathCompatibility(primary: Path, secondary: Path): PathCompatibilityResult {
	if (primary.cmds.length !== secondary.cmds.length) {
		return { ok: false, reason: COMMAND_MISMATCH_REASON };
	}

	for (let i = 0; i < primary.cmds.length; i += 1) {
		if (primary.cmds[i] !== secondary.cmds[i]) {
			return { ok: false, reason: COMMAND_MISMATCH_REASON };
		}
	}

	if (primary.crds.length !== secondary.crds.length) {
		return { ok: false, reason: COORDINATE_MISMATCH_REASON };
	}

	return { ok: true };
}

function clamp01(value: number): number {
	if (Number.isNaN(value)) {
		return 0;
	}

	if (value < 0) {
		return 0;
	}

	if (value > 1) {
		return 1;
	}

	return value;
}

export function interpolatePath(primary: Path, secondary: Path, t: number): Path {
	const compatibility = validatePathCompatibility(primary, secondary);
	if (!compatibility.ok) {
		throw new PathMorphError(compatibility.reason);
	}

	const progress = clamp01(t);
	const crds = primary.crds.map((start, index) => start + (secondary.crds[index] - start) * progress);

	return {
		cmds: [...primary.cmds],
		crds
	};
}
