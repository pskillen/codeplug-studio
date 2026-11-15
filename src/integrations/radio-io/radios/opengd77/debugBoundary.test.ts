import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The OpenGD77 debug capture is read-only. Its source files must not name any write, restore or
 * control builder: the frame guard is the runtime check, this is the review-time one.
 */
const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', '..', '..', '..');

const FILES = ['integrations/radio-io/radios/opengd77/debugGuard.ts'];

const FORBIDDEN: [string, RegExp][] = [
  ['makeSetFlashSectorFrame', /makeSetFlashSectorFrame/],
  ['makeWriteSectorBufferFrame', /makeWriteSectorBufferFrame/],
  ['makeFinishFlashSectorFrame', /makeFinishFlashSectorFrame/],
  ['makeWriteEepromFrame', /makeWriteEepromFrame/],
  ['.upload(', /\.upload\(/],
  ['uploadUserDatabase', /uploadUserDatabase/],
  ['restoreFromBackup', /restoreFromBackup/],
  ['OPENGD77_CONTROL_', /OPENGD77_CONTROL_/],
  ['OPENGD77_CMD_CONTROL', /OPENGD77_CMD_CONTROL/],
  [
    'makeCommandFrame with a flag other than show / close CPS',
    /makeCommandFrame\(\s*(?!OPENGD77_CMD_(?:SHOW|CLOSE)_CPS\b)[^)\s]/,
  ],
];

describe('OpenGD77 debug capture source boundary', () => {
  it.each(FILES)('%s names no write, restore or control builder', (file) => {
    const source = readFileSync(join(srcRoot, file), 'utf8');
    // Strip comments so prose may describe what is refused.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [name, pattern] of FORBIDDEN) {
      expect(pattern.test(code), `${file} references ${name}`).toBe(false);
    }
  });
});
