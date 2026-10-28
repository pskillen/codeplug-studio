import { describe, expect, it } from 'vitest';
import { evaluateRt95ChipGuard } from './chipGuard.ts';

function ident(prefix = 'RT95-P'): Uint8Array {
  const b = new Uint8Array(16).fill(0x30);
  b.set(new TextEncoder().encode(prefix), 0);
  b[prefix.length] = 0;
  return b;
}
const blank = new Uint8Array(16).fill(0xff);

describe('evaluateRt95ChipGuard', () => {
  it('passes with a good ident and a different alias block', () => {
    expect(evaluateRt95ChipGuard(ident(), blank)).toEqual({ ok: true });
  });
  it('reports aliased when both blocks are equal', () => {
    expect(evaluateRt95ChipGuard(ident(), ident())).toEqual({ ok: false, reason: 'aliased' });
  });
  it('reports read-failed for undefined on either side', () => {
    expect(evaluateRt95ChipGuard(undefined, blank)).toEqual({ ok: false, reason: 'read-failed' });
    expect(evaluateRt95ChipGuard(ident(), undefined)).toEqual({ ok: false, reason: 'read-failed' });
  });
  it('reports bad-ident for RT95-X', () => {
    expect(evaluateRt95ChipGuard(ident('RT95-X'), blank)).toEqual({
      ok: false,
      reason: 'bad-ident',
    });
  });
  it('reports bad-ident (not aliased) for two blank blocks', () => {
    expect(evaluateRt95ChipGuard(blank, blank)).toEqual({ ok: false, reason: 'bad-ident' });
  });
  it('reports read-failed for a 15-byte block', () => {
    expect(evaluateRt95ChipGuard(ident().subarray(0, 15), blank)).toEqual({
      ok: false,
      reason: 'read-failed',
    });
  });
});
