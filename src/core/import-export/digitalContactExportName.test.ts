import { describe, expect, it } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import {
  applyDigitalContactExportWireName,
  digitalContactExportBaseName,
  resolveDigitalContactExportBaseName,
} from './digitalContactExportName.ts';

describe('digitalContactExportBaseName', () => {
  const contact = {
    ...newDigitalContact('p1', 'Ada Lovelace', 123),
    callsign: 'M7ABC',
  };

  it('uses library name in name mode', () => {
    expect(digitalContactExportBaseName(contact, 'name')).toBe('Ada Lovelace');
  });

  it('uses callsign in callsign mode', () => {
    expect(digitalContactExportBaseName(contact, 'callsign')).toBe('M7ABC');
  });

  it('combines in callsign-name mode', () => {
    expect(digitalContactExportBaseName(contact, 'callsign-name')).toBe('M7ABC Ada Lovelace');
  });
});

describe('resolveDigitalContactExportBaseName', () => {
  it('prefers build wire name override', () => {
    const contact = newDigitalContact('p1', 'Ada', 1);
    const name = resolveDigitalContactExportBaseName(
      contact,
      [{ libraryEntityId: contact.id, wireName: 'Custom' }],
      'callsign',
    );
    expect(name).toBe('Custom');
  });
});

describe('applyDigitalContactExportWireName', () => {
  it('allows duplicate contact wire names without numeric suffix', () => {
    const warnings: string[] = [];
    const first = applyDigitalContactExportWireName('John', undefined, 'anytone-at-d890uv', warnings);
    const second = applyDigitalContactExportWireName('John', undefined, 'anytone-at-d890uv', warnings);
    expect(first).toBe(second);
    expect(first).not.toMatch(/ 2$/);
  });
});
