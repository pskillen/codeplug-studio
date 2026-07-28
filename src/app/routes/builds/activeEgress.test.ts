import { describe, expect, it } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  readStoredActiveEgressId,
  resolveActiveEgress,
  resolveActiveEgressId,
  writeStoredActiveEgressId,
} from './activeEgress.ts';

describe('activeEgress', () => {
  it('resolves stored preference when valid', () => {
    const { build, egress, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const serial = egressPaths.find((path) => path.profileId === 'radio-io-at-d890uv')!;
    writeStoredActiveEgressId(build.id, serial.id);
    expect(resolveActiveEgressId(build, egressPaths, readStoredActiveEgressId(build.id))).toBe(
      serial.id,
    );
    expect(
      resolveActiveEgress(build, egressPaths, readStoredActiveEgressId(build.id))?.profileId,
    ).toBe('radio-io-at-d890uv');
    expect(egress.profileId).toBe('anytone-at-d890uv');
  });

  it('falls back to first egress when preference is missing', () => {
    const { build, egressPaths } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    const resolved = resolveActiveEgress(build, egressPaths, null);
    expect(resolved).toBeTruthy();
    expect(['anytone-at-d890uv', 'radio-io-at-d890uv']).toContain(resolved!.profileId);
  });

  it('returns null when no egress paths exist', () => {
    const { build } = newRadioBuildForProfile('proj', 'anytone-at-d890uv');
    expect(resolveActiveEgress(build, [] as EgressPath[], null)).toBeNull();
  });
});
