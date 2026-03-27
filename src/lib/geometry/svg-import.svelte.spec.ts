import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import paper from 'paper';
import { importSvgFromString, addPreprocessor, clearPreprocessors } from './svg-import';

let scope: paper.PaperScope;

beforeEach(() => {
	scope = new paper.PaperScope();
	scope.setup(new paper.Size(1, 1));
});

afterEach(() => {
	clearPreprocessors();
});

const simpleSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <path d="M 0 0 L 50 100 L -50 100 Z"/>
</svg>`;

// expandShapes:true converts rect/circle to paths, so use a defs-only SVG to test no-path case
const noPathSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <defs><style>.cls-1{fill:red}</style></defs>
</svg>`;

describe('importSvgFromString', () => {
	it('extracts a path from a valid SVG', () => {
		const result = importSvgFromString(simpleSvg, scope);
		expect(result).not.toBeNull();
		expect(result!.cmds.length).toBeGreaterThan(0);
		expect(result!.crds.length).toBeGreaterThan(0);
	});

	it('returns null for an SVG with no paths', () => {
		const result = importSvgFromString(noPathSvg, scope);
		expect(result).toBeNull();
	});

	it('returns null for malformed input', () => {
		const result = importSvgFromString('not valid svg at all <<<', scope);
		expect(result).toBeNull();
	});

	it('returns null for an empty string', () => {
		const result = importSvgFromString('', scope);
		expect(result).toBeNull();
	});

	it('calls registered preprocessors with the imported item', () => {
		const preprocessor = vi.fn((item: paper.Item) => item);
		addPreprocessor(preprocessor);

		importSvgFromString(simpleSvg, scope);

		expect(preprocessor).toHaveBeenCalledOnce();
		expect(preprocessor.mock.calls[0][0]).toBeInstanceOf(paper.Item);
	});

	it('path commands only contain valid values', () => {
		const result = importSvgFromString(simpleSvg, scope);
		expect(result).not.toBeNull();
		const validCmds = new Set(['M', 'L', 'Q', 'C', 'Z']);
		for (const cmd of result!.cmds) {
			expect(validCmds.has(cmd)).toBe(true);
		}
	});

	it('crds array has the correct length for the commands', () => {
		const result = importSvgFromString(simpleSvg, scope);
		expect(result).not.toBeNull();

		const coordsPerCmd: Record<string, number> = { M: 2, L: 2, Q: 4, C: 6, Z: 0 };
		const expectedLen = result!.cmds.reduce((sum, cmd) => sum + coordsPerCmd[cmd], 0);
		expect(result!.crds.length).toBe(expectedLen);
	});
});
