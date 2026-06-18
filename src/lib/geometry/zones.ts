import type { Path, ZoneIntensity, ZoneDrive } from '$lib/types';

/** @deprecated unused after extent-relative rework; removed once ZonePreview migrates. */
export const ZONE_SCALE = 30;
/** @deprecated unused after extent-relative rework; removed once ZonePreview migrates. */
export const VIBR_AMT = 0.5;

/** Bass: outer tip reach as a multiple of petal radial extent (≈ full petal length). */
export const BASS_REACH = 1.2;
/** Mid: tangential widening as a fraction of radial extent. */
export const MID_X_REACH = 0.6;
/** Mid: slight radial-out nudge as a fraction of radial extent. */
export const MID_Y_REACH = 0.25;
/** Treble: inner-tip inward retraction as a fraction of radial extent. */
export const TREBLE_RETRACT = 0.5;
/** Treble: tangential vibration amplitude as a fraction of radial extent. */
export const VIBR_REACH = 0.3;

type AnchorInfo = {
	anchorIdx: number;
	entryHandleIdx: number | null;
	exitHandleIdx: number | null;
};

/**
 * Deforms an authored bezier path on three zones tied to audio bands. Drive
 * fields are normalized (0..1; trebleVibrate signed) and scaled by the petal's
 * own radial extent (maxY - minY) × per-band REACH, so deformation is
 * proportional to petal size. Anchors are sorted by Y ascending (lower Y = outer
 * in bend.ts space):
 *   outermost → bass → dy = -extent·BASS_REACH·bassPush (tip reaches radially out)
 *   middle(s)  → mid  → dx = +extent·MID_X_REACH·midPush, dy = -extent·MID_Y_REACH·midPush
 *   innermost  → treble → dy = +extent·TREBLE_RETRACT·trebleRetract (inward),
 *                         dx = extent·VIBR_REACH·trebleVibrate (tangential jitter)
 * Handles follow their anchor by the same vector. Pure — never mutates input.
 * Returns an unchanged copy when radial extent is zero (no tip/base to tell apart).
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

	// Radial extent of the petal (Y axis is radial; sorted ascending by Y).
	const minY = path.crds[sorted[0].anchorIdx + 1];
	const maxY = path.crds[sorted[sorted.length - 1].anchorIdx + 1];
	const radialExtent = maxY - minY;
	if (radialExtent === 0) return { cmds: [...path.cmds], crds };

	const bassDelta = bassPush * radialExtent * BASS_REACH;
	const midXDelta = midPush * radialExtent * MID_X_REACH;
	const midYDelta = midPush * radialExtent * MID_Y_REACH;
	const trebleRetractDelta = trebleRetract * radialExtent * TREBLE_RETRACT;
	const trebleVibrateDelta = trebleVibrate * radialExtent * VIBR_REACH;

	for (let i = 0; i < sorted.length; i++) {
		const anchor = sorted[i];
		let dx = 0;
		let dy = 0;

		if (i === 0) {
			// Outermost — bass — radially outward (decrease Y)
			dy = -bassDelta;
		} else if (i === sorted.length - 1) {
			// Innermost — treble — retract inward (increase Y) + tangential vibration
			dy = trebleRetractDelta;
			dx = trebleVibrateDelta;
		} else {
			// Middle — mid — tangential widening + slight radial push outward
			dx = midXDelta;
			dy = -midYDelta;
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
