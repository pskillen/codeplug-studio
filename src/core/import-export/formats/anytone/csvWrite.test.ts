import { describe, expect, it } from 'vitest';
import {
  ANYTONE_CSV_LINE_ENDING,
  escapeCsvField,
  formatCsv,
  formatCsvRow,
  sanitizeCsvFieldValue,
} from './csvWrite.ts';

describe('anytone/csvWrite', () => {
  describe('sanitizeCsvFieldValue', () => {
    it('strips embedded double quotes without substitution', () => {
      expect(sanitizeCsvFieldValue('Foo "bar"')).toBe('Foo bar');
      expect(sanitizeCsvFieldValue('a"b"c')).toBe('abc');
    });

    it('leaves values without quotes unchanged', () => {
      expect(sanitizeCsvFieldValue('Channel 1')).toBe('Channel 1');
    });
  });

  describe('escapeCsvField', () => {
    it('always double-quotes plain values', () => {
      expect(escapeCsvField('1')).toBe('"1"');
      expect(escapeCsvField('Channel 1')).toBe('"Channel 1"');
    });

    it('strips embedded quotes before wrapping', () => {
      expect(escapeCsvField('Foo "bar"')).toBe('"Foo bar"');
      expect(escapeCsvField('a"b"c')).toBe('"abc"');
    });

    it('preserves commas inside quoted fields', () => {
      expect(escapeCsvField('a,b')).toBe('"a,b"');
    });

    it('quotes empty strings', () => {
      expect(escapeCsvField('')).toBe('""');
    });
  });

  describe('formatCsvRow', () => {
    it('quotes every field in the row', () => {
      expect(formatCsvRow(['No.', 'Channel Name', '1'])).toBe('"No.","Channel Name","1"');
    });
  });

  describe('formatCsv', () => {
    it('quotes header and data rows with CRLF line endings', () => {
      const csv = formatCsv(['No.', 'Name'], [['1', 'Channel 1']]);
      expect(csv).toBe(
        `"No.","Name"${ANYTONE_CSV_LINE_ENDING}"1","Channel 1"${ANYTONE_CSV_LINE_ENDING}`,
      );
    });

    it('uses CRLF only — no bare LF between rows', () => {
      const csv = formatCsv(['No.', 'Name'], [['1', 'Channel 1']]);
      expect(csv).toContain('\r\n');
      expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
    });

    it('strips quotes from data values in full export', () => {
      const csv = formatCsv(['Name'], [['Foo "bar"']]);
      expect(csv).toBe(`"Name"${ANYTONE_CSV_LINE_ENDING}"Foo bar"${ANYTONE_CSV_LINE_ENDING}`);
    });
  });
});
