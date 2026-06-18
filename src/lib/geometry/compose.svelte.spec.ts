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
	aspectRatio: '1:1',
	rings: [
		{
			copies: 4,
			color: '#ff0000',
			templatePath: rectPath,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.4
		},
		{
			copies: 4,
			color: '#0000ff',
			templatePath: rectPath,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.4
		}
	],
	monochromePalettes: [{ main: '#000000', bg: '#ffffff' }],
	fullPalettes: [{ colors: ['#000000', '#ffffff'] }]
};

describe('renderComposition', () => {
	it('renders expected number of paths through pipeline', () => {
		renderComposition(twoRingComposition, scope);
		const children = scope.project.activeLayer.children;
		expect(children.length).toBe(2);
	});
});
