import { describe, expect, it } from 'vitest';
import { isRcVersion, parsePlayVersion, playTrackFor, versionCodeFor } from './version-code.mjs';

describe('versionCodeFor', () => {
  it.each([
    ['0.2.7-rc.1', 20_701],
    ['0.2.7-rc.4', 20_704],
    ['0.2.7', 20_799],
    ['v0.2.7-rc.4', 20_704],
    ['1.2.3-rc.4', 1_020_304],
    ['v1.2.3', 1_020_399],
    ['0.1.0-rc.1', 10_001],
    ['0.3.0-rc.1', 30_001],
    ['0.3.0', 30_099],
  ])('%s → %s', (tag, expected) => {
    expect(versionCodeFor(tag)).toBe(expected);
  });

  it('strips a v prefix and normalises versionName', () => {
    expect(parsePlayVersion('v1.2.3-rc.4').versionName).toBe('1.2.3-rc.4');
    expect(parsePlayVersion('1.2.3').versionName).toBe('1.2.3');
  });

  it('places a final release strictly above every RC of the same version', () => {
    expect(versionCodeFor('1.2.3-rc.1')).toBeLessThan(versionCodeFor('1.2.3'));
    expect(versionCodeFor('1.2.3-rc.98')).toBeLessThan(versionCodeFor('1.2.3'));
  });

  it('rejects unrecognised pre-release identifiers', () => {
    expect(() => versionCodeFor('1.2.3-beta.1')).toThrow(/unrecognised/);
    expect(() => versionCodeFor('1.2.3-alpha')).toThrow(/unrecognised/);
    expect(() => versionCodeFor('1.2.3-rc')).toThrow(/unrecognised/);
    expect(() => versionCodeFor('1.2.3-rc.')).toThrow(/unrecognised/);
  });

  it('rejects rc.99 and above (collision with the final-release slot)', () => {
    expect(() => versionCodeFor('1.2.3-rc.99')).toThrow(/rc\.99/);
    expect(() => versionCodeFor('1.2.3-rc.100')).toThrow(/out of range/);
  });

  it('rejects rc.0', () => {
    expect(() => versionCodeFor('1.2.3-rc.0')).toThrow(/out of range/);
  });

  it('rejects out-of-range fields', () => {
    expect(() => versionCodeFor('2101.0.0')).toThrow(/major/);
    expect(() => versionCodeFor('1.100.0')).toThrow(/minor/);
    expect(() => versionCodeFor('1.0.100')).toThrow(/patch/);
  });

  it('rejects empty input', () => {
    expect(() => versionCodeFor('')).toThrow(/required/);
    expect(() => versionCodeFor('   ')).toThrow(/required/);
  });

  it('maps a SemVer-sorted tag list to strictly increasing codes', () => {
    const tags = [
      '0.1.0-rc.1',
      '0.1.0-rc.2',
      '0.1.0',
      '0.1.1-rc.1',
      '0.1.1',
      '0.2.0',
      '1.0.0-rc.1',
      '1.0.0',
      '1.2.3-rc.4',
      '1.2.3',
    ];
    const codes = tags.map(versionCodeFor);
    for (let i = 1; i < codes.length; i += 1) {
      expect(codes[i], `${tags[i - 1]} → ${tags[i]}`).toBeGreaterThan(codes[i - 1]!);
    }
  });
});

describe('isRcVersion / playTrackFor', () => {
  it('treats -rc.N as Open testing', () => {
    expect(isRcVersion('1.2.3-rc.4')).toBe(true);
    expect(playTrackFor('1.2.3-rc.4')).toBe('beta');
  });

  it('treats a final tag as Production', () => {
    expect(isRcVersion('1.2.3')).toBe(false);
    expect(playTrackFor('v1.2.3')).toBe('production');
  });
});
