import { describe, expect, it } from 'vitest';
import { DM32_CSV_LINE_ENDING, escapeCsvField, formatCsv, formatCsvRow } from './csvWrite.ts';

describe('dm32/csvWrite', () => {
  describe('escapeCsvField', () => {
    it('quotes fields containing commas', () => {
      expect(escapeCsvField('a,b')).toBe('"a,b"');
    });

    it('doubles embedded quotes', () => {
      expect(escapeCsvField('Foo "bar"')).toBe('"Foo ""bar"""');
    });

    it('leaves plain values unquoted', () => {
      expect(escapeCsvField('Channel 1')).toBe('Channel 1');
    });
  });

  describe('formatCsvRow', () => {
    it('joins escaped fields with commas', () => {
      expect(formatCsvRow(['No.', 'Channel Name', '1'])).toBe('No.,Channel Name,1');
    });
  });

  describe('formatCsv', () => {
    it('joins header and data rows with CRLF line endings', () => {
      const csv = formatCsv(['No.', 'Name'], [['1', 'Channel 1']]);
      expect(csv).toBe(`No.,Name${DM32_CSV_LINE_ENDING}1,Channel 1${DM32_CSV_LINE_ENDING}`);
    });

    it('uses CRLF only — no bare LF between rows', () => {
      const csv = formatCsv(['No.', 'Name'], [['1', 'Channel 1']]);
      expect(csv).toContain('\r\n');
      expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
    });

    it('preserves OpenGD77-style escaping with CRLF', () => {
      const csv = formatCsv(['Name'], [['a,b']]);
      expect(csv).toBe(`Name${DM32_CSV_LINE_ENDING}"a,b"${DM32_CSV_LINE_ENDING}`);
    });
  });
});
