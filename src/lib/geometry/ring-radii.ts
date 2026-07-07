import type { Composition } from '$lib/types';

/**
 * Raggi cumulativi degli anelli. L'anello più interno (indice 0) sta a
 * `baseRadius`; ogni anello successivo somma al precedente il proprio incremento,
 * dove l'incremento è `incrementOverride ?? ringIncrement`. Senza override si
 * riduce a `baseRadius + ringIncrement * i`, identico alla spaziatura piatta
 * precedente.
 */
export function computeRingRadii(composition: Composition): number[] {
	const radii: number[] = [];
	let r = composition.baseRadius;
	for (let i = 0; i < composition.rings.length; i++) {
		if (i > 0) {
			r += composition.rings[i].incrementOverride ?? composition.ringIncrement;
		}
		radii.push(r);
	}
	return radii;
}
