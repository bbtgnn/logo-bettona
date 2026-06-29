import type { Composition } from '$lib/types';

export const DEFAULT_COMPOSITION: Composition = {
	baseRadius: 5,
	ringIncrement: 2,
	aspectRatio: '1:1',
	rings: [],
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
