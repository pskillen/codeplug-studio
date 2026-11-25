import { describe, expect, it } from 'vitest';
import { normalizeM17Callsign, normalizeM17Destination } from './m17Address.ts';

// Vectors from RadioFoundry channel-modes.txt.
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 The RadioFoundry Authors
describe('M17 destination text', () => {
  it.each([
    ['m17dstbad AB1CDEFGHI', 'AB1CDEFGHI', null],
    ['m17dstbad AB*CD', 'AB*CD', null],
    ['m17dstbad @ECHO', '@ECHO', null],
    ['m17dstbad M17_M17', 'M17_M17', null],
    ['m17enc 0 1 000616FACECAED M17-M17 A', 'M17-M17 A', 'M17-M17 A'],
    ['m17enc 3 1 030000009FDD51 ab1cd', 'ab1cd', 'AB1CD'],
    ['m17enc 0 1 0030BFE75C5D51 AB1CDEFGH', 'AB1CDEFGH', 'AB1CDEFGH'],
    ['m17enc 3 1 03000000000000 @all', '@all', ''],
  ])('%s', (_vector, text, expected) => {
    expect(normalizeM17Destination(text)).toBe(expected);
  });

  it.each([
    ['  m17-m17 a  ', 'M17-M17 A'],
    ['   ', ''],
    [' All ', ''],
    ['ab/c.d-1', 'AB/C.D-1'],
    ['ſ', null],
    ['ı', null],
    ['ß', null],
    ['A\tB', null],
  ])('normalizes %j', (text, expected) => {
    expect(normalizeM17Destination(text)).toBe(expected);
  });
});

describe('M17 operator callsign text', () => {
  it.each([
    ['m17rec 41423143442F50000000 AB1CD/P', 'AB1CD/P', 'AB1CD/P'],
    ['m17rec 41423143444546474849 -', 'AB1CDEFGHI', null],
    ['m17rec 41422043440000000000 -', 'AB CD', null],
    ['m17rec 41422A43440000000000 -', 'AB*CD', null],
  ])('%s', (_vector, text, expected) => {
    expect(normalizeM17Callsign(text)).toBe(expected);
  });

  it.each([
    ['  ab/c.d-1  ', 'AB/C.D-1'],
    ['ALL', 'ALL'],
    ['@ALL', null],
    ['', null],
    ['ı', null],
  ])('normalizes %j', (text, expected) => {
    expect(normalizeM17Callsign(text)).toBe(expected);
  });
});
