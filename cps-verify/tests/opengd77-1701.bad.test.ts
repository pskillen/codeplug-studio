import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = (name: string) => path.join(root, 'fixtures/opengd77/opengd77-1701/bad', name);

describe('opengd77-1701 bad fixtures', () => {
  it('fails on CRLF line endings (Studio requires LF)', async () => {
    const result = await verifyCodeplug({ format: 'opengd77', path: bad('crlf-endings') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'line-endings')).toBe(true);
  });

  it('fails on dangling zone channel foreign keys', async () => {
    const result = await verifyCodeplug({ format: 'opengd77', path: bad('dangling-fk') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'foreign-key')).toBe(true);
  });

  it('fails when channel name exceeds profile limit', async () => {
    const result = await verifyCodeplug({ format: 'opengd77', path: bad('over-long-name') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'name-length')).toBe(true);
  });
});
