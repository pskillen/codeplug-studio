import { describe, expect, it } from 'vitest';
import { DOTTED_ABBREV_PATTERN, toTitleCase } from './titleCase.ts';

describe('DOTTED_ABBREV_PATTERN', () => {
  it.each([
    ['N.I.', 'N.I.'],
    ['BELFAST N.I.', 'N.I.'],
    ['U.S.A.', 'U.S.A.'],
  ] as const)('matches %j as %j', (input, expected) => {
    const match = input.match(DOTTED_ABBREV_PATTERN);
    expect(match?.[0]).toBe(expected);
  });
});

describe('toTitleCase', () => {
  it.each([
    ['DERBY', 'Derby'],
    ['EAST KILBRIDE', 'East Kilbride'],
    ['OPERATIONAL', 'Operational'],
    ["M'FELT", "M'Felt"],
    ['NEWTON-LE-WILLOWS', 'Newton-Le-Willows'],
    ['', ''],
    ['  derby  ', 'Derby'],
    ['BELFAST N.I.', 'Belfast N.I.'],
    ['N.I.', 'N.I.'],
    ['LONDONDERRY N.I.', 'Londonderry N.I.'],
  ] as const)('formats %j as %j', (input, expected) => {
    expect(toTitleCase(input)).toBe(expected);
  });
});
