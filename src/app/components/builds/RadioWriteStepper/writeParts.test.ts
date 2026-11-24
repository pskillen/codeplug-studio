import { describe, expect, it } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  DEFAULT_WRITE_PARTS,
  clampPartsToSupport,
  tickedPartCount,
  warningsForParts,
  writeButtonLabel,
  writesToRadioImage,
} from './writeParts.ts';

const none = { codeplug: false, contacts: false, settings: false, keps: false };

describe('writeButtonLabel', () => {
  it.each([
    [{ ...none }, 'Write'],
    [{ ...none, codeplug: true }, 'Write codeplug'],
    [{ ...none, contacts: true }, 'Write contacts'],
    [{ ...none, keps: true }, 'Write keps'],
    [{ ...none, settings: true }, 'Write settings'],
    [{ ...none, codeplug: true, contacts: true }, 'Write codeplug + contacts'],
    [{ ...none, codeplug: true, keps: true }, 'Write codeplug + keps'],
    [{ ...none, contacts: true, keps: true }, 'Write contacts + keps'],
    [{ ...none, codeplug: true, contacts: true, keps: true }, 'Write 3 parts'],
    [{ codeplug: true, contacts: true, settings: true, keps: true }, 'Write 4 parts'],
  ])('%j -> %s', (parts, label) => {
    expect(writeButtonLabel(parts)).toBe(label);
  });
});

describe('write parts helpers', () => {
  it('defaults tick the codeplug only', () => {
    expect(DEFAULT_WRITE_PARTS).toEqual({
      codeplug: true,
      contacts: false,
      settings: false,
      keps: false,
    });
    expect(tickedPartCount(DEFAULT_WRITE_PARTS)).toBe(1);
  });

  it('drops ticks for rows the radio does not offer', () => {
    const clamped = clampPartsToSupport(
      { codeplug: true, contacts: true, settings: true, keps: true },
      { contacts: false, keps: true, settings: false },
    );
    expect(clamped).toEqual({ codeplug: true, contacts: false, settings: false, keps: true });
  });

  it('keps alone does not go through the radio image session', () => {
    expect(writesToRadioImage({ ...none, keps: true })).toBe(false);
    expect(writesToRadioImage({ ...none, contacts: true })).toBe(true);
    expect(writesToRadioImage({ ...none, codeplug: true })).toBe(true);
  });
});

const codeplugWarning: ExportWarning = {
  kind: 'general',
  severity: 'problem',
  message: 'codeplug truncation',
};
const contactWarning: ExportWarning = {
  kind: 'general',
  severity: 'problem',
  message: 'contact cap',
};

describe('warningsForParts', () => {
  it('warningsForParts keeps every warning when the codeplug is ticked', () => {
    expect(
      warningsForParts(
        { ...none, codeplug: true },
        { warnings: [codeplugWarning, contactWarning], contactWarnings: [contactWarning] },
      ),
    ).toEqual([codeplugWarning, contactWarning]);
  });

  it('warningsForParts keeps only contact warnings for contacts alone', () => {
    expect(
      warningsForParts(
        { ...none, contacts: true },
        { warnings: [codeplugWarning, contactWarning], contactWarnings: [contactWarning] },
      ),
    ).toEqual([contactWarning]);
  });

  it('warningsForParts is empty for keps alone', () => {
    expect(
      warningsForParts(
        { ...none, keps: true },
        { warnings: [codeplugWarning], contactWarnings: [contactWarning] },
      ),
    ).toEqual([]);
  });
});
