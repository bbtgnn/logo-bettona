import type { Composition, Path } from '$lib/types';

/**
 * The default arc curve. Shared by the seeded default ring below and by
 * DEFAULT_RING in composition.ts, so the two can never diverge.
 */
export const DEFAULT_RING_PATH: Path = {
	cmds: ['M', 'C', 'C'],
	crds: [
		20, 117.61326806392421, 59, 117.50800490602947, 32.43817613081838, 82.72961144836285,
		61.688995215311024, 62.77907643368346, 83.43200751345759, 47.9492445945898, 101,
		66.54953384995142, 180, 67.38673193607579
	]
};

export const DEFAULT_COMPOSITION: Composition = {
	baseRadius: 5,
	ringIncrement: 2,
	aspectRatio: '1:1',
	rings: [
		{
			id: 'ring-default',
			copies: 8,
			color: '#000000',
			templatePath: DEFAULT_RING_PATH,
			secondaryTemplatePath: null,
			morphT: 0,
			ringHeight: 0.12
		}
	],
	monochromePalettes: [
		{
			primary: '#000000',
			secondary: '#ffffff',
			background: '#ffffff'
		}
	],
	fullPalettes: [
		{
			colors: ['#1a1a2e', '#16213e', '#0f3460', '#e94560']
		},
		{
			colors: ['#2d6a4f', '#40916c', '#74c69d', '#d8f3dc']
		},
		{
			colors: ['#f72585', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0']
		},
		{
			colors: ['#000000', '#ffffff']
		}
	]
};
