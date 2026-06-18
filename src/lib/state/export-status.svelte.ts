/**
 * Shared animation-export status, so controls outside PreviewCanvas (e.g. the Canvas
 * aspect-ratio selector) can disable themselves while a render is in progress.
 */
export const exportStatus = $state<{ rendering: boolean }>({ rendering: false });
