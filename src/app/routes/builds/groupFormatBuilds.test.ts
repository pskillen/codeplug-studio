import { describe, expect, it } from 'vitest';
import { newRadioBuildWithEgresses } from '@core/domain/factories.ts';
import { groupFormatBuilds } from './groupFormatBuilds.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('groupFormatBuilds', () => {
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
