import { describe, expect, it } from 'vitest';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import { groupFormatBuilds } from './groupFormatBuilds.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('groupFormatBuilds', () => {
  it('groups by default egress format with catalog labels', () => {
    const builds = [
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-uv5r-mini').build, name: 'A' },
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-dm1701').build, name: 'B' },
      { ...newRadioBuildWithEgresses(projectId, 'retevis-rt95').build, name: 'C' },
    ];
    const groups = groupFormatBuilds(builds, 'format');
    expect(groups.map((g) => g.label)).toEqual(['CHIRP CSV', 'Direct radio', 'OpenGD77 CSV']);
    expect(groups.find((g) => g.label === 'CHIRP CSV')?.builds.map((b) => b.name)).toEqual(['C']);
    expect(groups.find((g) => g.label === 'Direct radio')?.builds.map((b) => b.name)).toEqual([
      'A',
    ]);
  });

  it('groups by radio target label', () => {
    const builds = [
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-uv5r-mini').build, name: 'Mini' },
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-uv21').build, name: 'Pro' },
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-uv5r-mini').build, name: 'Mini 2' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups.map((g) => g.label)).toEqual(['Baofeng UV-21Pro V2', 'Baofeng UV-5R Mini']);
    expect(groups.find((g) => g.key === 'radio:baofeng-uv5r-mini')?.builds).toHaveLength(2);
  });

  it('groups DM-32 as one radio target (all egress paths on one build)', () => {
    const builds = [
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-dm32uv').build, name: 'DM-32' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('radio:baofeng-dm32uv');
    expect(groups[0]?.label).toBe('Baofeng DM-32UV');
  });

  it('groups UV-5R Mini as one radio target (CHIRP, NeonPlug, Web Serial egresses)', () => {
    const builds = [
      { ...newRadioBuildWithEgresses(projectId, 'baofeng-uv5r-mini').build, name: 'UV-5R' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('radio:baofeng-uv5r-mini');
    expect(groups[0]?.label).toBe('Baofeng UV-5R Mini');
  });
});
