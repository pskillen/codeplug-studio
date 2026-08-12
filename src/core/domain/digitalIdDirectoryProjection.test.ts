import { describe, expect, it } from 'vitest';
import {
  defaultDualBankWriteOptions,
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
} from './digitalIdDirectoryProjection.ts';

describe('digitalIdDirectoryProjection', () => {
  it('libraryDigitalIdSet collects positive digitalIds', () => {
    expect(
      libraryDigitalIdSet([
        { digitalId: 91 },
        { digitalId: 0 },
        { digitalId: 2355 },
        { digitalId: 91 },
      ]),
    ).toEqual(new Set([91, 2355]));
  });

  it('shouldIncludeDirectoryRow skips ids present in library set', () => {
    const library = libraryDigitalIdSet([{ digitalId: 42 }]);
    expect(shouldIncludeDirectoryRow(42, library)).toBe(false);
    expect(shouldIncludeDirectoryRow(43, library)).toBe(true);
    expect(shouldIncludeDirectoryRow(0, library)).toBe(false);
  });

  it('defaultDualBankWriteOptions matches product tables', () => {
    expect(defaultDualBankWriteOptions('codeplug')).toEqual({
      includeLibraryContacts: true,
      includeDigitalIdDirectory: false,
    });
    expect(defaultDualBankWriteOptions('digitalIdList')).toEqual({
      includeLibraryContacts: false,
      includeDigitalIdDirectory: true,
    });
  });
});
