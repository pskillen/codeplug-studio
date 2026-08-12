import { describe, expect, it } from 'vitest';
import { pushWireNameCollisionWarning, pushWireNameLengthWarning } from './wireNameWarning.ts';

describe('pushWireNameLengthWarning', () => {
  it('includes exported shortened name when shortening succeeds', () => {
    const warnings: string[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Talk group',
      original: 'Australia, New Zealand',
      exported: 'AU NZ',
      maxLen: 16,
      profileLabel: 'Anytone AT-D890UV',
      shortenEnabled: true,
    });
    expect(warnings).toEqual([
      'Talk group wire name "Australia, New Zealand" exceeds 16 characters for Anytone AT-D890UV; exported as "AU NZ"',
    ]);
  });

  it('reports when shortened name still exceeds the limit', () => {
    const warnings: string[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original: 'Very Long Original Name',
      exported: 'Still Too Long Name',
      maxLen: 10,
      shortenEnabled: true,
    });
    expect(warnings[0]).toContain('shortened to "Still Too Long Name" still exceeds limit');
  });

  it('omits warning when original fits within limit', () => {
    const warnings: string[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Zone',
      original: 'Glasgow',
      exported: 'Glasgow',
      maxLen: 16,
      shortenEnabled: true,
    });
    expect(warnings).toEqual([]);
  });
});

describe('pushWireNameCollisionWarning', () => {
  it('pushes a collision message when the name was disambiguated', () => {
    const warnings: string[] = [];
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Channel',
      candidate: 'Glasgow',
      disambiguated: 'Glasgow 2',
    });
    expect(warnings).toEqual([
      'Channel wire name "Glasgow" collided with another exported name; disambiguated as "Glasgow 2"',
    ]);
  });

  it('omits warning when the candidate was not disambiguated', () => {
    const warnings: string[] = [];
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Zone',
      candidate: 'Edinburgh',
      disambiguated: 'Edinburgh',
    });
    expect(warnings).toEqual([]);
  });
});
