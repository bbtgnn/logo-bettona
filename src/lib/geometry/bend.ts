import paper from 'paper';
import type { Ring, Path } from '$lib/types';
import { toPaperPath } from './path-codec';

// Audio-zone deformation, applied in FINAL polar space (see buildRingPath). Radial
// amounts are fractions of the ring radius so the tip travels outward toward the
// reserved edge (like the old p5 sketch's spintaBassi), instead of being re-absorbed
// by the template's bounding-box normalization. Tangential amounts are fractions of
// the per-copy arc half-angle.
const ZONE_BASS_REACH = 1.2; // outer tip: radial push outward
const ZONE_MID_TANG = 0.35; // mid: tangential widening (± arc angle)
const ZONE_MID_RADIAL = 0.15; // mid: slight radial push outward
const ZONE_TREBLE_RETRACT = 0.3; // inner tip: radial retraction inward
const ZONE_TREBLE_TANG = 0.1; // inner: small tangential lean

/**
 * Builds the full closed paper.js path for one ring at the given radius.
 *
 * Strategy:
 *  1. Compute bounding box of the template path.
 *  2. Map each anchor: x → angle in [0, alpha], y → radius in [r*(1-h), r].
 *  3. Transform each handle using tangent-space decomposition at its anchor.
 *  4. Mirror the half-arc about angle=0 to get the other half.
 *  5. Tile the full copy `ring.copies` times around the circle.
 */
export function buildRingPath(
	ring: Ring,
	radius: number,
	scope: paper.PaperScope
): paper.Path | null {
	if (!ring.templatePath || ring.templatePath.cmds.length === 0) return null;

	scope.activate();

	const alpha = Math.PI / ring.copies; // arc half-angle per copy

	// Build a temporary paper path to get the bounding box
	const tmpPath = toPaperPath(ring.templatePath, scope);
	const bbox = tmpPath.bounds;
	tmpPath.remove();

	if (bbox.width === 0 || bbox.height === 0) return null;

	const segments = getSegments(ring.templatePath);

	// Audio-zone roles by radial position: lowest Y (→ lowest ty → largest r) is the
	// OUTER tip (bass), highest Y is the INNER tip (treble), the rest are MID. Roles are
	// taken from the REST template (bbox is the rest shape), so they never shift mid-beat.
	const drive = ring.zoneDrive ?? null;
	let outerIdx = 0;
	let innerIdx = 0;
	for (let i = 1; i < segments.length; i++) {
		if (segments[i].point.y < segments[outerIdx].point.y) outerIdx = i;
		if (segments[i].point.y > segments[innerIdx].point.y) innerIdx = i;
	}

	// Transform anchor to polar, then to Cartesian
	function anchorToPolar(x: number, y: number): { angle: number; r: number } {
		const tx = (x - bbox.x) / bbox.width;
		const ty = (y - bbox.y) / bbox.height;
		const angle = tx * alpha;
		const r = radius * (1 - ring.ringHeight + ring.ringHeight * (1 - ty));
		return { angle, r };
	}

	function polarToCartesian(angle: number, r: number): paper.Point {
		return new paper.Point(Math.cos(angle) * r, Math.sin(angle) * r);
	}

	// Build one half-arc (spanning [0, alpha])
	function buildHalfArc(mirror: boolean): paper.Segment[] {
		return segments.map((seg, idx) => {
			let { angle: anchorAngle, r: anchorR } = anchorToPolar(seg.point.x, seg.point.y);

			// Deform in final polar space: radial push escapes the thin ring band and
			// travels toward the reserved edge; tangential widens the petal. Handles use
			// the deformed angle/r below, so they follow the moved anchor cleanly.
			if (drive) {
				if (idx === outerIdx) {
					anchorR += drive.bassPush * radius * ZONE_BASS_REACH;
				} else if (idx === innerIdx) {
					anchorR -= drive.trebleRetract * radius * ZONE_TREBLE_RETRACT;
					anchorAngle += drive.trebleVibrate * alpha * ZONE_TREBLE_TANG;
				} else {
					anchorAngle += drive.midPush * alpha * ZONE_MID_TANG;
					anchorR += drive.midPush * radius * ZONE_MID_RADIAL;
				}
			}

			const sign = mirror ? -1 : 1;
			const mappedAngle = sign * anchorAngle;
			const anchorPos = polarToCartesian(mappedAngle, anchorR);

			const mappedHandleIn = transformHandle(
				seg.handleIn,
				anchorAngle,
				anchorR,
				sign,
				bbox,
				ring,
				radius,
				alpha
			);
			const mappedHandleOut = transformHandle(
				seg.handleOut,
				anchorAngle,
				anchorR,
				sign,
				bbox,
				ring,
				radius,
				alpha
			);

			return new paper.Segment(anchorPos, mappedHandleIn, mappedHandleOut);
		});
	}

	// Assemble one full copy: half-arc forward + half-arc mirrored (reversed)
	function buildOneCopy(rotationAngle: number): paper.Segment[] {
		const forward = buildHalfArc(false);
		const mirrored = buildHalfArc(true).reverse();

		// Reverse the mirrored arc: flip handles since we're traversing backwards
		const mirroredFlipped = mirrored.map(
			(seg) => new paper.Segment(seg.point, seg.handleOut.clone(), seg.handleIn.clone())
		);

		const allSegs = [...mirroredFlipped, ...forward];

		// Rotate by rotationAngle
		if (rotationAngle === 0) return allSegs;
		return allSegs.map((seg) => {
			const rotPoint = seg.point.rotate(rotationAngle * (180 / Math.PI), new paper.Point(0, 0));
			const origin = new paper.Point(0, 0);
			const rotIn = seg.handleIn.rotate(rotationAngle * (180 / Math.PI), origin);
			const rotOut = seg.handleOut.rotate(rotationAngle * (180 / Math.PI), origin);
			return new paper.Segment(rotPoint, rotIn, rotOut);
		});
	}

	// Tile all copies
	const fullCopyAngle = (2 * Math.PI) / ring.copies;
	const allSegments: paper.Segment[] = [];

	for (let k = 0; k < ring.copies; k++) {
		const copySegs = buildOneCopy(k * fullCopyAngle);
		allSegments.push(...copySegs);
	}

	const path = new paper.Path({ segments: allSegments, closed: true });
	return path;
}

/**
 * Transforms a handle (relative to its anchor) using tangent-space decomposition.
 *
 * In the original space:
 *   - dx (horizontal) maps to tangential motion along the arc
 *   - dy (vertical) maps to radial motion
 *
 * After mapping:
 *   - tangential component: dx/bbox.width * alpha * anchorR  (arc length at anchorR)
 *   - radial component:     dy/bbox.height * ringHeight * radius
 *
 * The resulting handle is expressed as a Cartesian vector relative to the
 * transformed anchor position.
 */
function transformHandle(
	handle: paper.Point,
	anchorAngle: number,
	anchorR: number,
	sign: number,
	bbox: paper.Rectangle,
	ring: Ring,
	radius: number,
	alpha: number
): paper.Point {
	if (handle.isZero()) return new paper.Point(0, 0);

	const dx = handle.x / bbox.width;
	const dy = handle.y / bbox.height;

	// Tangential: scales with arc length at anchorR
	const tangentialMag = dx * alpha * anchorR;
	// Radial: scales with ring height in world units
	const radialMag = -dy * ring.ringHeight * radius;

	// Tangent direction at anchorAngle: perpendicular to radius, in direction of increasing angle
	const tangentDir = new paper.Point(
		-Math.sin(sign * anchorAngle),
		Math.cos(sign * anchorAngle)
	).multiply(sign);
	// Radial direction: outward from center
	const radialDir = new paper.Point(Math.cos(sign * anchorAngle), Math.sin(sign * anchorAngle));

	return tangentDir.multiply(tangentialMag).add(radialDir.multiply(radialMag));
}

type SegmentData = {
	point: paper.Point;
	handleIn: paper.Point;
	handleOut: paper.Point;
};

function getSegments(p: Path): SegmentData[] {
	const segs: SegmentData[] = [];
	let ci = 0;
	let currentPoint = new paper.Point(0, 0);
	let firstPoint = new paper.Point(0, 0);

	// We need to build the segment list from the path commands.
	// Each segment has a point, handleIn, and handleOut.
	// We use a temporary paper path to extract segments accurately.

	// Actually, let's just parse the commands into a list of (point, handleIn, handleOut) tuples.
	// Since our Path format uses absolute coords and only M/L/Q/C/Z, we can do this directly.

	const points: paper.Point[] = [];
	const handlesIn: paper.Point[] = [];
	const handlesOut: paper.Point[] = [];

	for (let i = 0; i < p.cmds.length; i++) {
		const cmd = p.cmds[i];

		switch (cmd) {
			case 'M': {
				const pt = new paper.Point(p.crds[ci], p.crds[ci + 1]);
				ci += 2;
				currentPoint = pt;
				firstPoint = pt;
				points.push(pt);
				handlesIn.push(new paper.Point(0, 0));
				handlesOut.push(new paper.Point(0, 0));
				break;
			}
			case 'L': {
				const pt = new paper.Point(p.crds[ci], p.crds[ci + 1]);
				ci += 2;
				currentPoint = pt;
				points.push(pt);
				handlesIn.push(new paper.Point(0, 0));
				handlesOut.push(new paper.Point(0, 0));
				break;
			}
			case 'Q': {
				// Convert quadratic to cubic for uniform handling
				const cp = new paper.Point(p.crds[ci], p.crds[ci + 1]);
				const endPt = new paper.Point(p.crds[ci + 2], p.crds[ci + 3]);
				ci += 4;

				// Quadratic → cubic conversion:
				// cp1 = start + 2/3 * (cp - start)
				// cp2 = end   + 2/3 * (cp - end)
				const cp1 = currentPoint.add(cp.subtract(currentPoint).multiply(2 / 3));
				const cp2 = endPt.add(cp.subtract(endPt).multiply(2 / 3));

				// handleOut of previous point
				handlesOut[handlesOut.length - 1] = cp1.subtract(currentPoint);

				currentPoint = endPt;
				points.push(endPt);
				handlesIn.push(cp2.subtract(endPt));
				handlesOut.push(new paper.Point(0, 0));
				break;
			}
			case 'C': {
				const cp1 = new paper.Point(p.crds[ci], p.crds[ci + 1]);
				const cp2 = new paper.Point(p.crds[ci + 2], p.crds[ci + 3]);
				const endPt = new paper.Point(p.crds[ci + 4], p.crds[ci + 5]);
				ci += 6;

				handlesOut[handlesOut.length - 1] = cp1.subtract(currentPoint);

				currentPoint = endPt;
				points.push(endPt);
				handlesIn.push(cp2.subtract(endPt));
				handlesOut.push(new paper.Point(0, 0));
				break;
			}
			case 'Z': {
				// If the last point equals firstPoint, drop it to avoid duplicate
				if (points.length > 0) {
					const last = points[points.length - 1];
					if (last.getDistance(firstPoint) < 0.001) {
						points.pop();
						handlesIn.pop();
						handlesOut.pop();
					}
				}
				break;
			}
		}
	}

	for (let i = 0; i < points.length; i++) {
		segs.push({ point: points[i], handleIn: handlesIn[i], handleOut: handlesOut[i] });
	}

	return segs;
}
