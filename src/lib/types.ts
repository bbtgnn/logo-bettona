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

export type ZoneIntensity = { bass: number; mid: number; treble: number };
export type ZoneDrive = {
	bassPush: number; // outermost: radial-out magnitude
	midPush: number; // middle: tangential widen (drives radial too, ratio internal)
	trebleRetract: number; // innermost: steady inward magnitude
	trebleVibrate: number; // innermost: signed tangential oscillation
};
export type EnvelopeParams = { attack: number; release: number };
export type AudioZonesConfig = {
	defaultIntensity: ZoneIntensity;
};

export type Ring = {
	id: string;
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
	wave?: WaveState | null; // absent/null → no wave → renders identical to today
	waveConfig?: WaveConfig | null; // null/absent = inherit global AudioBarsConfig default
	zoneConfig?: ZoneIntensity | null; // persisted; null = inherit global default
	zoneDrive?: ZoneDrive | null; // transient; stripped from persistence
};

export type MonochromePalette = {
	primary: string;
	secondary: string;
	background: string;
};

export type FullPalette = {
	colors: string[];
};

export type ColorMode = 'monochrome' | 'palette' | 'manual';

export type ColorModeState = {
	mode: ColorMode;
	palette: number;
};

export type AspectRatio = '1:1' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9';

export type Composition = {
	baseRadius: number;
	ringIncrement: number;
	aspectRatio: AspectRatio;
	rings: Ring[];
	monochromePalettes: MonochromePalette[];
	fullPalettes: FullPalette[];
};

export type PathLibraryEntry = {
	id: string;
	name: string;
	createdAt: number;
	path: Path;
	secondaryPath: Path | null;
	// Built-in default curves are author-provided and cannot be deleted by the user.
	builtin?: boolean;
};

export type PathLibrary = {
	entries: PathLibraryEntry[];
};