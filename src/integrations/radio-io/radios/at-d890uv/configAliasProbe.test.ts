import { describe, expect, it } from 'vitest';
import {
  AT_D890_CONFIG_ALIAS_PAIRS,
  AT_D890_CONFIG_ALIAS_STRIDE,
  analyseAtD890ConfigAliasPair,
  analyseAtD890ConfigAliasReport,
  formatAtD890ConfigAliasMarkdown,
} from './configAliasProbe.ts';
import { D890_MAP } from './constants.ts';

function localInfoLike(serial: string): Uint8Array {
  const out = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
  const bytes = new TextEncoder().encode(serial);
  out.set(bytes.slice(0, 16), 0x30);
  out[0x04] = 0x01;
  out[0x05] = 0x01;
  return out;
}

describe('AT_D890_CONFIG_ALIAS_PAIRS', () => {
  it('uses +0x40000 alias candidates for each erase-relevant region', () => {
    for (const pair of AT_D890_CONFIG_ALIAS_PAIRS) {
      expect(pair.aliasCandidate - pair.base).toBe(AT_D890_CONFIG_ALIAS_STRIDE);
    }
  });
});

describe('analyseAtD890ConfigAliasPair', () => {
  it('reports inconclusive when both spans are all 0xff', () => {
    const erased = new Uint8Array(0x200).fill(0xff);
    expect(analyseAtD890ConfigAliasPair(erased, erased)).toMatchObject({
      status: 'inconclusive_both_erased',
      nonFfBytesBase: 0,
      nonFfBytesAlias: 0,
    });
  });

  it('reports aliased when non-trivial bytes match', () => {
    const base = localInfoLike('SN1234567890ABCD');
    const alias = new Uint8Array(base);
    expect(analyseAtD890ConfigAliasPair(base, alias)).toMatchObject({
      status: 'aliased',
      nonFfBytesBase: expect.any(Number),
    });
    expect(analyseAtD890ConfigAliasPair(base, alias).nonFfBytesBase).toBeGreaterThan(0);
  });

  it('reports flat when any byte differs', () => {
    const base = localInfoLike('SN1234567890ABCD');
    const alias = new Uint8Array(base);
    alias[0x30] = 0x00;
    expect(analyseAtD890ConfigAliasPair(base, alias)).toMatchObject({ status: 'flat' });
  });

  it('reports flat when one side is erased and the other is not', () => {
    const base = localInfoLike('SN1234567890ABCD');
    const alias = new Uint8Array(base.length).fill(0xff);
    expect(analyseAtD890ConfigAliasPair(base, alias)).toMatchObject({ status: 'flat' });
  });
});

describe('analyseAtD890ConfigAliasReport', () => {
  const pairInputs = AT_D890_CONFIG_ALIAS_PAIRS.map((spec) => ({
    id: spec.id,
    baseBytes: new Uint8Array(spec.length).fill(0xff),
    aliasBytes: new Uint8Array(spec.length).fill(0xff),
  }));

  it('gates proceed when every pair is flat', () => {
    const local = localInfoLike('SN1234567890ABCD');
    const different = new Uint8Array(local);
    different[0x31] ^= 0x01;
    const readings = pairInputs.map((p) =>
      p.id === 'localInfo'
        ? { ...p, baseBytes: local, aliasBytes: different }
        : {
            ...p,
            baseBytes: new Uint8Array(p.baseBytes.length).fill(0x00),
            aliasBytes: new Uint8Array(p.baseBytes.length).fill(0xaa),
          },
    );
    const report = analyseAtD890ConfigAliasReport(readings);
    expect(report.sparseRmwGate).toBe('proceed');
    expect(report.pairs.every((p) => p.status === 'flat')).toBe(true);
  });

  it('gates replan when any pair aliases', () => {
    const local = localInfoLike('SN1234567890ABCD');
    const readings = pairInputs.map((p) =>
      p.id === 'localInfo' ? { ...p, baseBytes: local, aliasBytes: new Uint8Array(local) } : p,
    );
    const report = analyseAtD890ConfigAliasReport(readings);
    expect(report.sparseRmwGate).toBe('replan');
  });

  it('gates partial when config pairs are inconclusive but LocalInfo is flat', () => {
    const local = localInfoLike('SN1234567890ABCD');
    const different = new Uint8Array(local);
    different[0x40] ^= 0x01;
    const readings = pairInputs.map((p) =>
      p.id === 'localInfo' ? { ...p, baseBytes: local, aliasBytes: different } : p,
    );
    const report = analyseAtD890ConfigAliasReport(readings);
    expect(report.sparseRmwGate).toBe('partial');
    expect(report.pairs.find((p) => p.id === 'optionalSettingsMain')?.status).toBe(
      'inconclusive_both_erased',
    );
  });
});

describe('formatAtD890ConfigAliasMarkdown', () => {
  it('includes status labels and gate summary', () => {
    const report = analyseAtD890ConfigAliasReport(
      AT_D890_CONFIG_ALIAS_PAIRS.map((spec) => ({
        id: spec.id,
        baseBytes: new Uint8Array(spec.length).fill(0xff),
        aliasBytes: new Uint8Array(spec.length).fill(0xff),
      })),
    );
    const md = formatAtD890ConfigAliasMarkdown(report, {
      measuredAt: '2026-07-27',
      model: 'ID890UV',
      readBlockSize: 0xf0,
    });
    expect(md).toContain('inconclusive — both erased');
    expect(md).toContain('PR5 gate');
  });
});
