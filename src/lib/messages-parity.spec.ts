import { describe, it, expect } from 'vitest';
import en from '../../messages/en.json';
import itLocale from '../../messages/it.json';

function keys(obj: Record<string, unknown>): string[] {
	return Object.keys(obj)
		.filter((k) => k !== '$schema')
		.sort();
}

describe('message catalogs', () => {
	it('en and it define exactly the same keys', () => {
		expect(keys(en as Record<string, unknown>)).toEqual(keys(itLocale as Record<string, unknown>));
	});
});
