import { describe, expect, it } from 'vitest';
import { findEncodedNameCollisions } from './findEncodedNameCollisions.ts';

describe('findEncodedNameCollisions', () => {
  it('returns groups with two or more matching ids', () => {
    expect(
      findEncodedNameCollisions([
        { id: 'a', encodedName: 'ISS FM' },
        { id: 'b', encodedName: 'ISS FM' },
        { id: 'c', encodedName: 'AO-7' },
      ]),
    ).toEqual([{ encodedName: 'ISS FM', ids: ['a', 'b'] }]);
  });

  it('returns empty when all names are unique', () => {
    expect(
      findEncodedNameCollisions([
        { id: 'a', encodedName: 'ISS FM' },
        { id: 'b', encodedName: 'AO-7' },
      ]),
    ).toEqual([]);
  });
});
