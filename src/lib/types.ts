export type Path = {
	cmds: ('M' | 'L' | 'Q' | 'C' | 'Z')[];
	crds: number[];
};

export type WaveState = {
	amplitude: number; // 0..1, fraction of the template width
	crests: number; // integer >= 1, number of periods along the petal
	phase: number; // radians
};

export type WaveConfig = {
	crests: number; // integer >= 1, periods along the petal
	amplitudeGain: number; // band energy (0..1) → wave amplitude scaling
	phaseSpeed: number; // rad/sec, travel speed of the wave
};

export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
	wave?: WaveState | null; // absent/null → no wave → renders identical to today
	waveConfig?: WaveConfig | null; // null/absent = inherit global AudioBarsConfig default
};

export type MonochromePalette = {
	main: string;
	bg: string;
};

export type FullPalette = {
	colors: string[];
};

export type ColorMode = 'monochrome' | 'palette' | 'manual';

export type ColorModeState = {
	mode: ColorMode;
	palette: number;
};

export type Composition = {
	baseRadius: number;
	ringIncrement: number;
	rings: Ring[];
	monochromePalettes: MonochromePalette[];
	fullPalettes: FullPalette[];
};
