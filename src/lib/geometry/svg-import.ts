import paper from 'paper';
import type { Path } from '$lib/types';

export type Preprocessor = (item: paper.Item) => paper.Item;

const preprocessors: Preprocessor[] = [];

export function addPreprocessor(fn: Preprocessor): void {
	preprocessors.push(fn);
}

export function clearPreprocessors(): void {
	preprocessors.length = 0;
}

export async function importSvg(file: File, scope: paper.PaperScope): Promise<Path | null> {
	const text = await file.text();
	return importSvgFromString(text, scope);
}

export function importSvgFromString(svgText: string, scope: paper.PaperScope): Path | null {
	scope.activate();

	let imported: paper.Item | null;
	try {
		imported = scope.project.importSVG(svgText, { expandShapes: true, insert: false });
	} catch {
		return null;
	}
	if (!imported) return null;

	// Run through preprocessor pipeline
	let processed: paper.Item = imported as paper.Item;
	for (const fn of preprocessors) {
		processed = fn(processed);
	}

	// Reject compound paths (multiple subpaths / multiple M commands)
	if (
		processed instanceof paper.CompoundPath ||
		processed.getItem({ class: paper.CompoundPath }) !== null
	) {
		return null;
	}

	// Find the first Path in the tree
	const pathItem = findFirstPath(processed);
	if (!pathItem) return null;

	// Flatten all transforms into absolute coordinates
	pathItem.applyMatrix = true;

	return segmentsToPath(pathItem);
}

function findFirstPath(item: paper.Item): paper.Path | null {
	if (item instanceof paper.Path) return item;
	return item.getItem({ class: paper.Path }) as paper.Path | null;
}

function segmentsToPath(path: paper.Path): Path {
	const cmds: Path['cmds'] = [];
	const crds: number[] = [];

	const segs = path.segments;
	if (segs.length === 0) return { cmds, crds };

	// Move to first point
	cmds.push('M');
	crds.push(segs[0].point.x, segs[0].point.y);

	for (let i = 1; i < segs.length; i++) {
		emitSegment(segs[i - 1], segs[i], cmds, crds);
	}

	// Close path: segment from last back to first
	if (path.closed) {
		emitSegment(segs[segs.length - 1], segs[0], cmds, crds);
		cmds.push('Z');
	}

	return { cmds, crds };
}

function emitSegment(
	from: paper.Segment,
	to: paper.Segment,
	cmds: Path['cmds'],
	crds: number[]
): void {
	const hasHandles = !from.handleOut.isZero() || !to.handleIn.isZero();

	if (hasHandles) {
		// Cubic bezier: control points are absolute
		const cp1 = from.point.add(from.handleOut);
		const cp2 = to.point.add(to.handleIn);
		cmds.push('C');
		crds.push(cp1.x, cp1.y, cp2.x, cp2.y, to.point.x, to.point.y);
	} else {
		cmds.push('L');
		crds.push(to.point.x, to.point.y);
	}
}
