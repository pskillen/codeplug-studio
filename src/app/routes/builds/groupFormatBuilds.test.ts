import { describe, expect, it } from 'vitest';
import { newFormatBuild } from '@core/domain/factories.ts';
import { groupFormatBuilds } from './groupFormatBuilds.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('groupFormatBuilds', () => {
  it('groups by format with catalog labels', () => {
    const builds = [
      { ...newFormatBuild(projectId, 'chirp-uv5r'), name: 'A' },
      { ...newFormatBuild(projectId, 'opengd77-1701'), name: 'B' },
      { ...newFormatBuild(projectId, 'chirp-rt95'), name: 'C' },
    ];
    const groups = groupFormatBuilds(builds, 'format');
    expect(groups.map((g) => g.label)).toEqual(['CHIRP CSV', 'OpenGD77 CSV']);
    expect(groups[0]?.builds.map((b) => b.name)).toEqual(['A', 'C']);
  });

  it('groups by radio profile label', () => {
    const builds = [
      { ...newFormatBuild(projectId, 'chirp-uv5r'), name: 'Mini' },
      { ...newFormatBuild(projectId, 'chirp-uv21'), name: 'Pro' },
      { ...newFormatBuild(projectId, 'chirp-uv5r'), name: 'Mini 2' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups.map((g) => g.label)).toEqual(['Baofeng UV-21Pro V2', 'Baofeng UV-5R Mini']);
    expect(groups.find((g) => g.key === 'radio:baofeng-uv5r-mini')?.builds).toHaveLength(2);
  });

  it('groups DM-32 CPS and NeonPlug as the same radio', () => {
    const builds = [
      { ...newFormatBuild(projectId, 'dm32-baofeng-dm32uv'), name: 'CSV' },
      { ...newFormatBuild(projectId, 'neonplug-dm32uv'), name: 'Neon' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('radio:baofeng-dm32uv');
    expect(groups[0]?.label).toBe('Baofeng DM-32UV');
    expect(groups[0]?.builds.map((b) => b.name)).toEqual(['CSV', 'Neon']);
  });

  it('groups UV-5R Mini CHIRP and NeonPlug as the same radio', () => {
    const builds = [
      { ...newFormatBuild(projectId, 'chirp-uv5r'), name: 'CHIRP' },
      { ...newFormatBuild(projectId, 'neonplug-uv5rmini'), name: 'Neon' },
    ];
    const groups = groupFormatBuilds(builds, 'radio');
    expect(groups).toHaveLength(1);
    expect(groups[0]?.key).toBe('radio:baofeng-uv5r-mini');
    expect(groups[0]?.label).toBe('Baofeng UV-5R Mini');
    expect(groups[0]?.builds.map((b) => b.name)).toEqual(['CHIRP', 'Neon']);
  });
});
