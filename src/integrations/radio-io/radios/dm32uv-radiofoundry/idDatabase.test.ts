import { describe, expect, it } from 'vitest';
import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  DMR_ID_DATABASE_ADDRESS,
  DMR_ID_DATABASE_HEADER_BYTES,
  DMR_ID_DATABASE_MAX_RECORDS,
  DMR_ID_DATABASE_RECORD_BYTES,
  DMR_ID_DATABASE_SIZE_BYTE,
  encodeDmrIdDatabase,
  idDatabaseText,
  type DmrIdDatabaseRow,
} from './idDatabase.ts';

const ALPHABET = ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.';

function row(digitalId: number, callsign: string, name = ''): DmrIdDatabaseRow {
  return { digitalId, callsign, name };
}

function unpackText(packed: Uint8Array): string {
  let text = '';
  const chars = (packed.length * 4) / 3;
  for (let j = 0; j < chars; j += 1) {
    const bit = 6 * j;
    const byte = Math.floor(bit / 8);
    const w = ((packed[byte] ?? 0) << 8) | (packed[byte + 1] ?? 0);
    const code = (w >> (10 - (bit % 8))) & 0x3f;
    text += ALPHABET[code] ?? '?';
  }
  return text.trimEnd();
}

describe('encodeDmrIdDatabase', () => {
  it('writes an Id N header, a 27-byte record, and callsign name text', () => {
    const warnings: ExportWarning[] = [];
    const bytes = encodeDmrIdDatabase([row(123456, 'M7ABC', 'Ada')], warnings);
    expect(warnings).toEqual([]);
    expect(bytes).not.toBeNull();
    expect(DMR_ID_DATABASE_ADDRESS).toBe(0x50000);
    expect(DMR_ID_DATABASE_ADDRESS).not.toBe(0x700000);
    expect(DMR_ID_DATABASE_SIZE_BYTE).toBe(0x65);
    expect(bytes![2]).toBe(0x4e);
    expect(bytes![2]).not.toBe(0x6e);
    expect([...bytes!.subarray(0, 12)]).toEqual([
      0x49, 0x64, 0x4e, 0x65, 0x30, 0x30, 0x31, 0x00, 1, 0, 0, 0,
    ]);
    expect(bytes!.length).toBe(DMR_ID_DATABASE_HEADER_BYTES + DMR_ID_DATABASE_RECORD_BYTES);
    expect([bytes![12], bytes![13], bytes![14]]).toEqual([0x40, 0xe2, 0x01]);
    expect(unpackText(bytes!.subarray(15, 15 + 24))).toBe('M7ABC Ada');
    expect(idDatabaseText('M7-ABC', 'Ada')).toBe('M7 ABC Ada');
  });

  it('sorts records by ascending DMR ID and drops rows that do not fit in area 1', () => {
    const warnings: ExportWarning[] = [];
    const rows = [
      row(30, 'C'),
      row(10, 'A'),
      row(0, 'Zero'),
      ...Array.from({ length: DMR_ID_DATABASE_MAX_RECORDS }, (_, index) => row(1000 + index, 'N')),
    ];
    const bytes = encodeDmrIdDatabase(rows, warnings);
    expect(bytes!.length).toBe(
      DMR_ID_DATABASE_HEADER_BYTES + DMR_ID_DATABASE_MAX_RECORDS * DMR_ID_DATABASE_RECORD_BYTES,
    );
    expect(bytes![12]! | (bytes![13]! << 8) | (bytes![14]! << 16)).toBe(10);
    const messages = warnings.map(formatExportWarning).join('\n');
    expect(messages).toMatch(/does not fit in 3 bytes/);
    expect(messages).toMatch(/do not fit in area 1/);
    expect(bytes![2]).toBe(0x4e);
  });

  it('owns nothing when every row is dropped', () => {
    const warnings: ExportWarning[] = [];
    expect(encodeDmrIdDatabase([row(0, 'Zero'), row(-1, 'Neg')], warnings)).toBeNull();
  });
});
