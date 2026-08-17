import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { describe, expect, it } from 'vitest';
import {
  defaultDualBankWriteOptions,
  defaultSingleBankProjectionMode,
  dualBankOptionsFromWriteSource,
  libraryDigitalIdSet,
  projectSingleBankDigitalContacts,
  shouldIncludeDirectoryRow,
  singleBankProjectionFromWriteSource,
  writeSourceIncludesDirectory,
  type ProjectedDigitalContactRow,
} from './digitalIdDirectoryProjection.ts';

function row(digitalId: number, wireName = `ID${digitalId}`): ProjectedDigitalContactRow {
  return {
    digitalId,
    wireName,
    callsign: '',
    city: '',
    province: '',
    country: '',
    remark: '',
  };
}

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

  it('defaultSingleBankProjectionMode matches product tables', () => {
    expect(defaultSingleBankProjectionMode('codeplug')).toBe('contacts-only');
    expect(defaultSingleBankProjectionMode('digitalIdList')).toBe('directory-only');
  });

  it('maps Write radio popup source to dual-bank toggles and single-bank projection', () => {
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
    expect(singleBankProjectionFromWriteSource('none')).toBe('skip');
    expect(singleBankProjectionFromWriteSource('library')).toBe('contacts-only');
    expect(singleBankProjectionFromWriteSource('directory')).toBe('directory-only');
    expect(singleBankProjectionFromWriteSource('both')).toBe('merge');
    expect(writeSourceIncludesDirectory('none')).toBe(false);
    expect(writeSourceIncludesDirectory('library')).toBe(false);
    expect(writeSourceIncludesDirectory('directory')).toBe(true);
    expect(writeSourceIncludesDirectory('both')).toBe(true);
  });

  describe('projectSingleBankDigitalContacts', () => {
    it('merge keeps library first and skips overlapping directory ids', () => {
      const library = [row(42, 'Lib42'), row(99, 'Lib99')];
      const directory = [row(42, 'Dir42'), row(43, 'Dir43')];
      const { contacts, warnings } = projectSingleBankDigitalContacts({
        mode: 'merge',
        libraryContacts: library,
        directoryRows: directory,
        maxContacts: 100,
      });
      expect(contacts.map((c) => c.digitalId)).toEqual([42, 99, 43]);
      expect(warnings.some((w) => formatExportWarning(w).includes('Skipped 1 directory'))).toBe(
        true,
      );
    });

    it('skip returns empty contacts', () => {
      const { contacts } = projectSingleBankDigitalContacts({
        mode: 'skip',
        libraryContacts: [row(1)],
        directoryRows: [row(2)],
        maxContacts: 100,
      });
      expect(contacts).toEqual([]);
    });

    it('directory-only omits library contacts', () => {
      const { contacts } = projectSingleBankDigitalContacts({
        mode: 'directory-only',
        libraryContacts: [row(1)],
        directoryRows: [row(2)],
        maxContacts: 100,
      });
      expect(contacts.map((c) => c.digitalId)).toEqual([2]);
    });
  });
});
