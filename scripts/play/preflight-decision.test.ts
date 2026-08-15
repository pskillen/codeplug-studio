import { describe, expect, it } from 'vitest';
import { decidePreflight, flattenReleases, normaliseVersionName } from './preflight-decision.mjs';

describe('decidePreflight', () => {
  it('uploads when the versionCode is absent', () => {
    expect(
      decidePreflight({
        bundles: [{ versionCode: 20701 }],
        releases: [],
        versionCode: 20704,
        versionName: '0.2.7-rc.4',
      }),
    ).toEqual({ action: 'upload' });
  });

  it('reconciles when the code is present with a matching release name', () => {
    expect(
      decidePreflight({
        bundles: [{ versionCode: 20704 }],
        releases: [{ name: 'v0.2.7-rc.4', versionCodes: ['20704'] }],
        versionCode: 20704,
        versionName: '0.2.7-rc.4',
      }),
    ).toEqual({ action: 'reconcile' });
  });

  it('reconciles when the code is present but not yet on any track', () => {
    expect(
      decidePreflight({
        bundles: [{ versionCode: 20704 }],
        releases: [],
        versionCode: 20704,
        versionName: '0.2.7-rc.4',
      }),
    ).toEqual({ action: 'reconcile' });
  });

  it('fails when the code belongs to a different versionName', () => {
    const result = decidePreflight({
      bundles: [{ versionCode: 20799 }],
      releases: [{ name: '0.2.6', versionCodes: [20799] }],
      versionCode: 20799,
      versionName: '0.2.7',
    });
    expect(result.action).toBe('fail');
    expect(result.message).toMatch(/belongs to 0\.2\.6, not 0\.2\.7/);
  });
});

describe('flattenReleases / normaliseVersionName', () => {
  it('flattens track releases', () => {
    expect(
      flattenReleases([
        { releases: [{ name: 'a', versionCodes: [1] }] },
        { releases: [{ name: 'b', versionCodes: [2] }] },
      ]),
    ).toHaveLength(2);
  });

  it('strips a v prefix', () => {
    expect(normaliseVersionName('v1.2.3')).toBe('1.2.3');
  });
});
