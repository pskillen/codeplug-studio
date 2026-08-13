import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const backupPageDir = dirname(fileURLToPath(import.meta.url));

const FORBIDDEN_IMPORT_PATTERNS = [
  /from ['"][^'"]*prepareRadioWriteImage/,
  /from ['"][^'"]*seedProtocolForUpload/,
  /from ['"][^'"]*uploadPreparedRadioWrite/,
  /from ['"][^'"]*writeBuildToRadio/,
  /persistBuild\s*\(/,
  /(?<![.\w])assemble\s*\(/,
];

function readAppSource(relPath: string): string {
  return readFileSync(join(backupPageDir, relPath), 'utf8');
}

describe('BuildRadioBackupPage isolation', () => {
  it('does not import upload staging, assemble, or persist', () => {
    const sources = [
      'BuildRadioBackupPage.tsx',
      '../../services/radioBackupRestore.ts',
      '../../components/builds/RadioCloneSummaryView.tsx',
    ];
    for (const rel of sources) {
      const text = readAppSource(rel);
      for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    }
  });
});
