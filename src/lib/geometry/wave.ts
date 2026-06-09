import type { Path, WaveConfig, WaveState } from '$lib/types';

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
	if (wave.amplitude <= 0) {
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
		const nx = (x - minX) / width;
		const ny = (y - minY) / height;
		// Taper W(nx)=sin(pi*nx): W(0)=W(1)=0. bend.ts maps x→angle, so nx=0 is the
		// petal axis (mirror seam) and nx=1 the junction with the next copy. Zeroing
		// the displacement there lets the mirror and tiling rejoin without a step,
		// while full amplitude survives at mid-petal (nx=0.5).
		const taper = Math.sin(Math.PI * nx);
		const dx = wave.amplitude * width * Math.sin(wave.crests * Math.PI * ny + wave.phase) * taper;
		crds[i] = x + dx;
		// y unchanged
	}

	return { cmds: [...path.cmds], crds };
}

// All fields override or none — no partial field merging by design.
export function resolveWaveConfig(
	ring: { waveConfig?: WaveConfig | null },
	globalDefault: WaveConfig
): WaveConfig {
	return ring.waveConfig ?? globalDefault;
}
