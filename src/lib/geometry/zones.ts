import type { Path, ZoneIntensity, ZoneDrive } from '$lib/types';

/** Template-space units of deformation at intensity=1, audio-level=1. Tune empirically. */
export const ZONE_SCALE = 30;

/** Fraction of mid tangential push also applied radially (outward). */
export const MID_RADIAL_RATIO = 0.4;

type AnchorInfo = {
	anchorIdx: number;
	entryHandleIdx: number | null;
	exitHandleIdx: number | null;
};

/**
 * Deforms an authored bezier path on three zones tied to audio bands.
 * Anchors are sorted by Y ascending (lower Y = outer in bend.ts space):
 *   outermost → bass → dy = -bassPush  (tip reaches radially out)
 *   middle(s)  → mid  → dx = +midPush, dy = -midPush*MID_RADIAL_RATIO (widens + pushes out)
 *   innermost  → treble → dy = +trebleRetract (inward), dx = trebleVibrate (tangential jitter)
 * Handles follow their anchor by the same vector. Pure — never mutates input.
 */
export function applyZonesToPath(path: Path, drive: ZoneDrive): Path {
	const { bassPush, midPush, trebleRetract, trebleVibrate } = drive;

	if (bassPush === 0 && midPush === 0 && trebleRetract === 0 && trebleVibrate === 0) {
		return { cmds: [...path.cmds], crds: [...path.crds] };
	}

	const anchors: AnchorInfo[] = [];
	let cursor = 0;

	for (let ci = 0; ci < path.cmds.length; ci++) {
		const cmd = path.cmds[ci];
		if (cmd === 'M' || cmd === 'L') {
			anchors.push({ anchorIdx: cursor, entryHandleIdx: null, exitHandleIdx: null });
			cursor += 2;
		} else if (cmd === 'C') {
			// Coords: cp1x, cp1y, cp2x, cp2y, x, y
			// cp1 = exit handle of PREVIOUS anchor; cp2 = entry handle of THIS anchor
			const cp1Idx = cursor;
			const cp2Idx = cursor + 2;
			const anchorIdx = cursor + 4;
			if (anchors.length > 0) {
				anchors[anchors.length - 1].exitHandleIdx = cp1Idx;
			}
			anchors.push({ anchorIdx, entryHandleIdx: cp2Idx, exitHandleIdx: null });
			cursor += 6;
		} else if (cmd === 'Q') {
			// Coords: cpx, cpy, x, y  — single handle shared as exit of prev + entry of this
			const cpIdx = cursor;
			const anchorIdx = cursor + 2;
			if (anchors.length > 0) {
				anchors[anchors.length - 1].exitHandleIdx = cpIdx;
			}
			anchors.push({ anchorIdx, entryHandleIdx: cpIdx, exitHandleIdx: null });
			cursor += 4;
		}
		// 'Z': no coordinates
	}

	if (anchors.length === 0) return { cmds: [...path.cmds], crds: [...path.crds] };

	// Sort ascending by Y — lower Y = outer (farther from center) in bend.ts space
	const sorted = [...anchors].sort(
		(a, b) => path.crds[a.anchorIdx + 1] - path.crds[b.anchorIdx + 1]
	);

	const crds = [...path.crds];

	function translate(idx: number | null, dx: number, dy: number): void {
		if (idx === null) return;
		crds[idx] += dx;
		crds[idx + 1] += dy;
	}

	for (let i = 0; i < sorted.length; i++) {
		const anchor = sorted[i];
		let dx = 0;
		let dy = 0;

		if (i === 0) {
			// Outermost — bass — radially outward (decrease Y)
			dy = -bassPush;
		} else if (i === sorted.length - 1) {
			// Innermost — treble — retract inward (increase Y) + tangential vibration
			dy = trebleRetract;
			dx = trebleVibrate;
		} else {
			// Middle — mid — tangential widening + slight radial push outward
			dx = midPush;
			dy = -midPush * MID_RADIAL_RATIO;
		}

		translate(anchor.anchorIdx, dx, dy);
		translate(anchor.entryHandleIdx, dx, dy);
		translate(anchor.exitHandleIdx, dx, dy);
	}

	return { cmds: [...path.cmds], crds };
}

export function resolveZoneIntensity(
	ring: { zoneConfig?: { bass: number; mid: number; treble: number } | null },
	def: ZoneIntensity
): ZoneIntensity {
	return ring.zoneConfig ?? def;
}
