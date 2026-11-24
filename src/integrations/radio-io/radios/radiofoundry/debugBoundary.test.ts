import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** Read-only debug capture sources; phase 6 adds the route handler. */
export const RADIOFOUNDRY_DEBUG_CAPTURE_BOUNDARY_FILES = [
  'integrations/radio-io/radios/radiofoundry/debugGuard.ts',
  'integrations/radio-io/radios/radiofoundry/debugCapture.ts',
  'integrations/radio-io/radios/radiofoundry/debugText.ts',
  'app/routes/debug/radios/radioFoundryCapture.ts',
] as const;

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', '..', '..', '..');

const FORBIDDEN: [string, RegExp][] = [
  ['.upload(', /\.upload\(/],
  ['armWriteSource', /armWriteSource/],
  ['armAssembled', /armAssembled/],
  ['OP_BEGIN', /\bOP_BEGIN\b/],
  ['OP_BLOCK', /\bOP_BLOCK\b/],
  ['OP_DATA', /\bOP_DATA\b/],
  ['OP_END', /\bOP_END\b/],
  ['OP_COMMIT', /\bOP_COMMIT\b/],
  ['OP_ABORT', /\bOP_ABORT\b/],
  ['satelliteRequest', /satelliteRequest/],
  ['SATELLITE_COMMAND', /\bSATELLITE_COMMAND\b/],
  ['RADIOFOUNDRY_STORAGE_COMMAND', /\bRADIOFOUNDRY_STORAGE_COMMAND\b/],
  ['readStorageInfo', /readStorageInfo/],
  ['writeBlock', /writeBlock/],
];

describe('RadioFoundry debug capture source boundary', () => {
  it.each(RADIOFOUNDRY_DEBUG_CAPTURE_BOUNDARY_FILES)('%s names no write path', (file) => {
    const source = readFileSync(join(srcRoot, file), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const [name, pattern] of FORBIDDEN) {
      expect(pattern.test(code), `${file} references ${name}`).toBe(false);
    }
  });
});
