import type { Path, WaveState } from '$lib/types';

const EPSILON = 1e-6;

/**
 * Ripples a template path by shifting every x-coordinate with a smooth sine
 * whose argument runs along the normalized y-axis of the path.
 *
 * Why x: in bend.ts `anchorToPolar`, template x → angle (the wobble direction)
 * and y → radius (base ↔ tip of the petal). Perturbing x therefore moves points
 * tangentially. Anchors AND control points are perturbed with the same smooth
 * function, so the cubic/quadratic handles stay coherent.
 *
 * Pure: never mutates the input. amplitude <= 0 returns an unchanged copy, so a
 * ring without a wave (or at rest) renders identical to before.
 */
export function applyWaveToPath(path: Path, wave: WaveState): Path {
	if (!path || wave.amplitude <= 0) {
		return { cmds: [...path.cmds], crds: [...path.crds] };
	}

	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (let i = 0; i + 1 < path.crds.length; i += 2) {
		const x = path.crds[i];
		const y = path.crds[i + 1];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}

	const width = Math.max(maxX - minX, EPSILON);
	const height = Math.max(maxY - minY, EPSILON);

	const crds = [...path.crds];
	for (let i = 0; i + 1 < crds.length; i += 2) {
		const x = crds[i];
		const y = crds[i + 1];
		const ny = (y - minY) / height;
		const dx = wave.amplitude * width * Math.sin(wave.crests * Math.PI * ny + wave.phase);
		crds[i] = x + dx;
		// y unchanged
	}

	return { cmds: [...path.cmds], crds };
}
