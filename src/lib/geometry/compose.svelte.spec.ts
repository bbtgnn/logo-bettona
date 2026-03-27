import { describe, it, expect, beforeEach } from 'vitest';
import paper from 'paper';
import { renderComposition } from './compose';
import type { Composition, Path } from '$lib/types';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(600, 600));
});

const rectPath: Path = {
	cmds: ['M', 'L', 'L', 'L', 'Z'],
	crds: [0, 0, 100, 0, 100, 50, 0, 50]
};

const twoRingComposition: Composition = {
	baseRadius: 100,
	ringIncrement: 60,
	rings: [
		{ copies: 4, color: '#ff0000', templatePath: rectPath, ringHeight: 0.4 },
		{ copies: 4, color: '#0000ff', templatePath: rectPath, ringHeight: 0.4 }
	]
};

describe('renderComposition', () => {
	it('produces one paper.js path per renderable ring', () => {
		renderComposition(twoRingComposition, scope);
		const children = scope.project.activeLayer.children;
		expect(children.length).toBe(2);
	});

	it('skips rings with null templatePath', () => {
		const comp: Composition = {
			...twoRingComposition,
			rings: [
				{ copies: 4, color: '#ff0000', templatePath: null, ringHeight: 0.4 },
				{ copies: 4, color: '#0000ff', templatePath: rectPath, ringHeight: 0.4 }
			]
		};
		renderComposition(comp, scope);
		expect(scope.project.activeLayer.children.length).toBe(1);
	});

	it('index 0 ring is rendered on top (added last to the layer)', () => {
		renderComposition(twoRingComposition, scope);
		const children = scope.project.activeLayer.children;
		expect(children.length).toBe(2);

		// The last child in the layer is drawn on top in paper.js
		// Index 0 ring (red) should be last
		const topPath = children[children.length - 1] as paper.Path;
		const c = topPath.fillColor!;
		expect(Math.round(c.red * 255)).toBe(255);
		expect(Math.round(c.green * 255)).toBe(0);
		expect(Math.round(c.blue * 255)).toBe(0);
	});

	it('clears previous content on each call', () => {
		renderComposition(twoRingComposition, scope);
		expect(scope.project.activeLayer.children.length).toBe(2);

		renderComposition(twoRingComposition, scope);
		expect(scope.project.activeLayer.children.length).toBe(2);
	});

	it('produces no paths for an empty composition', () => {
		const empty: Composition = { baseRadius: 100, ringIncrement: 50, rings: [] };
		renderComposition(empty, scope);
		expect(scope.project.activeLayer.children.length).toBe(0);
	});
});
