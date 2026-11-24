import { describe, expect, it } from 'vitest';
import { evaluateRt95ChipGuard, rt95ChipGuardRetry } from './chipGuard.ts';
import { RT95_IDENT_PREFIX } from './layout.ts';

function identBlock(): Uint8Array {
  const b = new Uint8Array(16);
  RT95_IDENT_PREFIX.forEach((v, i) => {
    b[i] = v;
  });
  b[15] = 1;
  return b;
}

describe('rt95ChipGuardRetry', () => {
  it('empty-block is reconnect', () => {
    expect(rt95ChipGuardRetry('empty-block')).toBe('reconnect');
  });

  it('aliased, bad-ident and read-failed are none', () => {
    expect(rt95ChipGuardRetry('aliased')).toBe('none');
    expect(rt95ChipGuardRetry('bad-ident')).toBe('none');
    expect(rt95ChipGuardRetry('read-failed')).toBe('none');
  });
});

describe('evaluateRt95ChipGuard', () => {
  it('empty-block is reconnect advice path', () => {
    const result = evaluateRt95ChipGuard(identBlock(), new Uint8Array(16));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('empty-block');
  });
});