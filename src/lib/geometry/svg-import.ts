import paper from 'paper';
import type { Path } from '$lib/types';
import { fromPaperPath } from './path-codec';

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

	return fromPaperPath(pathItem);
}

function findFirstPath(item: paper.Item): paper.Path | null {
	if (item instanceof paper.Path) return item;
	return item.getItem({ class: paper.Path }) as paper.Path | null;
}
