import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { detectKind } from './columns.ts';

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../../test-data/anytone/at-d890uv',
);

function fixtureHeaderRow(fileName: string): string[] {
  const text = readFileSync(join(FIXTURE_DIR, fileName), 'utf8');
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  return firstLine.split(',').map((cell) => cell.replace(/^"|"$/g, '').trim());
}

describe('anytone detectKind', () => {
  it('classifies Channel.CSV', () => {
    expect(detectKind('Channel.CSV', fixtureHeaderRow('Channel.CSV'))).toBe('channels');
  });

  it('classifies DMRZone.CSV', () => {
    expect(detectKind('DMRZone.CSV', fixtureHeaderRow('DMRZone.CSV'))).toBe('zones');
  });

  it('classifies ScanList.CSV', () => {
    expect(detectKind('ScanList.CSV', fixtureHeaderRow('ScanList.CSV'))).toBe('scanLists');
  });

  it('classifies DMRTalkGroups.CSV', () => {
    expect(detectKind('DMRTalkGroups.CSV', fixtureHeaderRow('DMRTalkGroups.CSV'))).toBe(
      'talkGroups',
    );
  });

  it('classifies DMRReceiveGroupCallList.CSV', () => {
    expect(
      detectKind('DMRReceiveGroupCallList.CSV', fixtureHeaderRow('DMRReceiveGroupCallList.CSV')),
    ).toBe('rxGroupLists');
  });

  it('classifies DMRDigitalContactList.CSV', () => {
    expect(
      detectKind('DMRDigitalContactList.CSV', fixtureHeaderRow('DMRDigitalContactList.CSV')),
    ).toBe('contacts');
  });

  it('classifies RadioIDList.CSV', () => {
    expect(detectKind('RadioIDList.CSV', fixtureHeaderRow('RadioIDList.CSV'))).toBe('radioIds');
  });

  it('returns unknown for unrecognised headers', () => {
    expect(detectKind('mystery.CSV', ['Foo', 'Bar'])).toBe('unknown');
  });
});
