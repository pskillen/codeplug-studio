import { describe, expect, it } from 'vitest';
import {
  cpsDualBankOptionsForBuild,
  defaultDualBankWriteOptions,
  dualBankOptionsFromWriteSource,
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
  writeSourceIncludesDirectory,
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

  it('maps Write radio popup source to dual-bank toggles', () => {
    expect(dualBankOptionsFromWriteSource('none')).toEqual({
      includeLibraryContacts: false,
      includeDigitalIdDirectory: false,
    });
    expect(dualBankOptionsFromWriteSource('library')).toEqual({
      includeLibraryContacts: true,
      includeDigitalIdDirectory: false,
    });
    expect(dualBankOptionsFromWriteSource('directory')).toEqual({
      includeLibraryContacts: false,
      includeDigitalIdDirectory: true,
    });
    expect(dualBankOptionsFromWriteSource('both')).toEqual({
      includeLibraryContacts: true,
      includeDigitalIdDirectory: true,
    });
    expect(writeSourceIncludesDirectory('none')).toBe(false);
    expect(writeSourceIncludesDirectory('library')).toBe(false);
    expect(writeSourceIncludesDirectory('directory')).toBe(true);
    expect(writeSourceIncludesDirectory('both')).toBe(true);
  });

  describe('cpsDualBankOptionsForBuild', () => {
    it('returns the stored dual-bank choice over a legacy single-bank mode', () => {
      expect(
        cpsDualBankOptionsForBuild({
          cpsDualBankDirectory: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
          cpsSingleBankProjectionMode: 'merge',
        }),
      ).toEqual({ includeLibraryContacts: false, includeDigitalIdDirectory: true });
    });

    it('maps each legacy single-bank mode once', () => {
      expect(cpsDualBankOptionsForBuild({ cpsSingleBankProjectionMode: 'contacts-only' })).toEqual({
        includeLibraryContacts: true,
        includeDigitalIdDirectory: false,
      });
      expect(cpsDualBankOptionsForBuild({ cpsSingleBankProjectionMode: 'directory-only' })).toEqual(
        { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      );
      expect(cpsDualBankOptionsForBuild({ cpsSingleBankProjectionMode: 'merge' })).toEqual({
        includeLibraryContacts: true,
        includeDigitalIdDirectory: true,
      });
      expect(cpsDualBankOptionsForBuild({ cpsSingleBankProjectionMode: 'skip' })).toEqual({
        includeLibraryContacts: false,
        includeDigitalIdDirectory: false,
      });
    });

    it('defaults to library on, directory off', () => {
      expect(cpsDualBankOptionsForBuild(undefined)).toEqual(
        defaultDualBankWriteOptions('codeplug'),
      );
      expect(cpsDualBankOptionsForBuild({})).toEqual(defaultDualBankWriteOptions('codeplug'));
    });
  });
});
