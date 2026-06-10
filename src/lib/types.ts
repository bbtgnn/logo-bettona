export type Path = {
	cmds: ('M' | 'L' | 'Q' | 'C' | 'Z')[];
	crds: number[];
};

export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	secondaryTemplatePath: Path | null;
	morphT: number;
	ringHeight: number;
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

export type PathLibraryEntry = {
	id: string;
	name: string;
	createdAt: number;
	path: Path;
	secondaryPath: Path | null;
};

export type PathLibrary = {
	entries: PathLibraryEntry[];
};
