export type Path = {
	cmds: ('M' | 'L' | 'Q' | 'C' | 'Z')[];
	crds: number[];
};

export type Ring = {
	copies: number;
	color: string;
	templatePath: Path | null;
	ringHeight: number;
};

export type Composition = {
	baseRadius: number;
	ringIncrement: number;
	rings: Ring[];
};
