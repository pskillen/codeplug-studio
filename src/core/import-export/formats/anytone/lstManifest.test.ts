import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
import {
  ANYTONE_CPS_MANIFEST_ORDER,
  anytoneLstFileName,
  orderExportedFilesForManifest,
  sanitiseLstProjectStem,
  serialiseAnytoneLstManifest,
} from './lstManifest.ts';

const fixtureLst = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../../test-data/anytone/at-d890uv/meep.LST',
  ),
  'utf8',
);

describe('anytone lstManifest', () => {
  it('fixture defines 38-file canonical order', () => {
    expect(ANYTONE_CPS_MANIFEST_ORDER).toHaveLength(38);
    const lines = fixtureLst.trim().split(/\r?\n/);
    expect(lines[0]).toBe('38');
    for (let i = 0; i < 38; i += 1) {
      expect(lines[i + 1]).toBe(`${i},"${ANYTONE_CPS_MANIFEST_ORDER[i]}"`);
    }
  });

  it('sanitises project stem for LST filename', () => {
    expect(sanitiseLstProjectStem('meep')).toBe('meep');
    expect(sanitiseLstProjectStem(' Meep ')).toBe('meep');
    expect(anytoneLstFileName('meep')).toBe('meep.LST');
  });

  it('serialises DMR MVP export with canonical indices', () => {
    const exported = [...ANYTONE_EXPORT_FILE_NAMES];
    const manifest = serialiseAnytoneLstManifest(exported);
    expect(manifest).toBe(
      [
        '7',
        '0,"Channel.CSV"',
        '1,"RadioIDList.CSV"',
        '2,"DMRZone.CSV"',
        '3,"ScanList.CSV"',
        '5,"DMRTalkGroups.CSV"',
        '8,"DMRReceiveGroupCallList.CSV"',
        '15,"DMRDigitalContactList.CSV"',
      ].join('\n') + '\n',
    );
  });

  it('appends AMAir.CSV at canonical index 27 when present', () => {
    const exported = [...ANYTONE_EXPORT_FILE_NAMES, 'AMAir.CSV'];
    const entries = orderExportedFilesForManifest(exported);
    expect(entries.map((e) => e.index)).toEqual([0, 1, 2, 3, 5, 8, 15, 27]);
    expect(serialiseAnytoneLstManifest(exported).split('\n')[8]).toBe('27,"AMAir.CSV"');
  });

  it('ignores unknown files and .LST in input', () => {
    const manifest = serialiseAnytoneLstManifest([
      'Channel.CSV',
      'meep.LST',
      'NotAReal.CSV',
      'RadioIDList.CSV',
    ]);
    expect(manifest).toBe(['2', '0,"Channel.CSV"', '1,"RadioIDList.CSV"'].join('\n') + '\n');
  });
});
