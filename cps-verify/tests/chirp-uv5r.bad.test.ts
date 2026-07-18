import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { verifyCodeplug } from '../src/verify.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bad = (name: string) => path.join(root, 'fixtures/chirp/chirp-uv5r/bad', name);

describe('chirp-uv5r bad fixtures', () => {
  it('fails on CRLF line endings (Studio requires LF)', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: bad('crlf-endings') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'line-endings')).toBe(true);
  });

  it('fails on wrong headers', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: bad('wrong-headers') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'headers')).toBe(true);
  });

  it('fails when channel name exceeds profile limit', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: bad('over-long-name') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'name-length')).toBe(true);
  });

  it('fails when row count exceeds max memory slots', async () => {
    const result = await verifyCodeplug({ format: 'chirp', path: bad('over-slots') });
    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.rule === 'cardinality')).toBe(true);
  });
});
