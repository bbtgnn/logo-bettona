import paper from 'paper';
import type { Path } from '$lib/types';

/**
 * The Path codec: the single translation between the persisted `Path` model
 * (`cmds` + flat `crds`, see `$lib/types`) and a live `paper.Path`.
 *
 * This conversion used to be hand-rolled in three places (RingCanvas's editor,
 * `bend.buildTempPath`, `svg-import.segmentsToPath`); it now lives here so the
 * arity walk, the C-else-L emit rule, and the closed-path handling are defined
 * once and testable without a DOM.
 *
 * Round-trip contract: `fromPaperPath(toPaperPath(p, scope))` reproduces `p`
 * for open paths made of M/L/C. Two normalizations apply:
 *  - Q is accepted on the way in (built as a true quadratic) but never produced
 *    on the way out — paper segments are cubic, so a Q survives as an equivalent
 *    C. Stored paths are M/C/L/Z in practice, so Q is defensive.
 *  - A closed path (Z) gains the edge back to the start as an explicit command
 *    before Z (e.g. M/L/L/Z → M/L/L/L/Z). Shape-identical, but the closing edge
 *    becomes explicit.
 */

/** Build a live `paper.Path` from a stored `Path`, in the given scope. */
export function toPaperPath(p: Path, scope: paper.PaperScope): paper.Path {
	scope.activate();
	const path = new paper.Path();
	let ci = 0;

	for (const cmd of p.cmds) {
		switch (cmd) {
			case 'M':
				path.moveTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
				ci += 2;
				break;
			case 'L':
				path.lineTo(new paper.Point(p.crds[ci], p.crds[ci + 1]));
				ci += 2;
				break;
			case 'Q':
				path.quadraticCurveTo(
					new paper.Point(p.crds[ci], p.crds[ci + 1]),
					new paper.Point(p.crds[ci + 2], p.crds[ci + 3])
				);
				ci += 4;
				break;
			case 'C':
				path.cubicCurveTo(
					new paper.Point(p.crds[ci], p.crds[ci + 1]),
					new paper.Point(p.crds[ci + 2], p.crds[ci + 3]),
					new paper.Point(p.crds[ci + 4], p.crds[ci + 5])
				);
				ci += 6;
				break;
			case 'Z':
				path.closePath();
				break;
		}
	}

	return path;
}

/** Serialize a live `paper.Path` back into the stored `Path` model. */
export function fromPaperPath(pp: paper.Path): Path {
	const cmds: Path['cmds'] = [];
	const crds: number[] = [];

	const segs = pp.segments;
	if (segs.length === 0) return { cmds, crds };

	cmds.push('M');
	crds.push(segs[0].point.x, segs[0].point.y);

	for (let i = 1; i < segs.length; i++) {
		emitSegment(segs[i - 1], segs[i], cmds, crds);
	}

	// Close: the segment from the last anchor back to the first.
	if (pp.closed) {
		emitSegment(segs[segs.length - 1], segs[0], cmds, crds);
		cmds.push('Z');
	}

	return { cmds, crds };
}

/**
 * Emit one segment between two adjacent anchors. A cubic (`C`) is written when
 * either endpoint carries a handle — control points are the absolute anchor +
 * handle; otherwise a straight `L`.
 */
function emitSegment(
	from: paper.Segment,
	to: paper.Segment,
	cmds: Path['cmds'],
	crds: number[]
): void {
	if (!from.handleOut.isZero() || !to.handleIn.isZero()) {
		const cp1 = from.point.add(from.handleOut);
		const cp2 = to.point.add(to.handleIn);
		cmds.push('C');
		crds.push(cp1.x, cp1.y, cp2.x, cp2.y, to.point.x, to.point.y);
	} else {
		cmds.push('L');
		crds.push(to.point.x, to.point.y);
	}
}
