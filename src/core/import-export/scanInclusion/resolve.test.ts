import { describe, expect, it } from 'vitest';
import {
  effectiveScanSkips,
  resolveEffectiveScanInclusion,
  scanInclusionFromLegacyBoolean,
} from './resolve.ts';
import type { ScanInclusion } from '@core/models/library.ts';

const channel = (scanInclusion: ScanInclusion) => ({ scanInclusion });

describe('resolveEffectiveScanInclusion', () => {
  it('maps explicit skip and alwaysScan', () => {
    expect(resolveEffectiveScanInclusion(channel('skip'), {})).toBe('skip');
    expect(resolveEffectiveScanInclusion(channel('alwaysScan'), {})).toBe('scan');
  });

  it('resolves default from build then format', () => {
    expect(
      resolveEffectiveScanInclusion(channel('default'), {
        buildDefault: 'skip',
        formatDefault: 'scan',
      }),
    ).toBe('skip');
    expect(
      resolveEffectiveScanInclusion(channel('default'), {
        formatDefault: 'skip',
      }),
    ).toBe('skip');
    expect(resolveEffectiveScanInclusion(channel('default'), {})).toBe('scan');
  });

  it('effectiveScanSkips mirrors skip outcome', () => {
    expect(effectiveScanSkips(channel('skip'), {})).toBe(true);
    expect(effectiveScanSkips(channel('alwaysScan'), { formatDefault: 'skip' })).toBe(false);
    expect(
      effectiveScanSkips(channel('default'), { buildDefault: 'skip', formatDefault: 'scan' }),
    ).toBe(true);
  });

  it('migrates legacy boolean', () => {
    expect(scanInclusionFromLegacyBoolean(true)).toBe('skip');
    expect(scanInclusionFromLegacyBoolean(false)).toBe('default');
  });
});
