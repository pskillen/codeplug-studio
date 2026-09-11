import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { stringifyCsv } from './csv.mjs';
import { loadTemplateHeader, validatePath } from './validate-dataset.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLE = join(__dirname, 'example.csv');
const HEADER = loadTemplateHeader();

function writeCsv(rows: string[][]): string {
  const dir = mkdtempSync(join(tmpdir(), 'public-services-'));
  const path = join(dir, 'channels.csv');
  writeFileSync(path, stringifyCsv(rows), 'utf8');
  return path;
}

function validFmRow(overrides: Record<number, string> = {}): string[] {
  const row = [
    'ZZ',
    '',
    '',
    'fire',
    'zz-test',
    'Test group',
    'fg-1',
    'NFRS FG1',
    'Fireground 1',
    '449012500',
    '449012500',
    'fm',
    'true',
    '12.5',
    '',
    '',
    '',
    '',
    '',
    'none',
    'active',
    'medium',
    'official',
    'https://example.org/a',
    'Title',
    '2024',
    '',
    '',
  ];
  for (const [index, value] of Object.entries(overrides)) {
    row[Number(index)] = value;
  }
  return row;
}

describe('validate-dataset', () => {
  it('accepts the fictional example.csv', () => {
    expect(validatePath(EXAMPLE, HEADER)).toEqual([]);
  });

  it('rejects a UTF-8 BOM', () => {
    const dir = mkdtempSync(join(tmpdir(), 'public-services-'));
    const path = join(dir, 'channels.csv');
    writeFileSync(path, `\uFEFF${stringifyCsv([HEADER, validFmRow()])}`);
    expect(validatePath(path, HEADER).some((error: string) => error.includes('BOM'))).toBe(true);
  });

  it('rejects a name longer than 16 characters', () => {
    const path = writeCsv([HEADER, validFmRow({ 7: 'THIS NAME IS 17C!' })]);
    expect(validatePath(path, HEADER).some((error: string) => error.includes('max 16'))).toBe(true);
  });

  it('rejects a dual-mode channel without exactly one primary', () => {
    const fm = validFmRow();
    const dmr = validFmRow({
      11: 'dmr',
      13: '',
      16: '1',
    });
    const path = writeCsv([HEADER, fm, dmr]);
    expect(
      validatePath(path, HEADER).some((error: string) => error.includes('is_primary_mode=true')),
    ).toBe(true);
  });

  it('rejects a DMR colour code on an FM row', () => {
    const path = writeCsv([HEADER, validFmRow({ 16: '1' })]);
    expect(
      validatePath(path, HEADER).some((error: string) => error.includes("colour_code' must be blank")),
    ).toBe(true);
  });

  it('rejects high confidence without an official source or corroboration', () => {
    const path = writeCsv([HEADER, validFmRow({ 21: 'high', 22: 'community' })]);
    expect(validatePath(path, HEADER).some((error: string) => error.includes('confidence=high'))).toBe(
      true,
    );
  });

  it('matches the template header', () => {
    expect(HEADER.join(',')).toBe(
      'country_code,region,service_org,category,group_id,group_label,channel_id,name,label,rx_frequency_hz,tx_frequency_hz,mode,is_primary_mode,bandwidth_khz,rx_tone,tx_tone,colour_code,timeslot,talkgroup_id,encryption,status,confidence,source_type,source_url,source_title,source_date,source_url_2,notes',
    );
  });
});
