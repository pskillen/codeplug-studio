import { describe, expect, it } from 'vitest';
import { emptyLibrary, newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { resolveWireNames } from './resolveWireNames.ts';

function effectiveNames(profileId: string, callsign: string, name: string, override?: string) {
  const lib = emptyLibrary();
  const channel = newChannel('proj', name, callsign);
  lib.channels.push(channel);
  const { build } = newRadioBuildForProfile('proj', profileId);
  if (override) {
    build.channelOverrides = upsertOverride(build.channelOverrides, channel.id, {
      wireName: override,
    });
  }
  const rows = resolveWireNames({
    build,
    library: librarySliceFrom(lib),
    entityKind: 'channel',
    formatId: 'radio-io',
    profileId,
  });
  return rows[0]!;
}

describe('RT95 MM9PDY radio name', () => {
  const MM = 'radio-io-rt95-mm9pdy';

  it('uses the Callsign when set', () => {
    expect(effectiveNames(MM, 'GB3GL', 'Glasgow repeater').effective).toBe('GB3GL');
  });
  it('shortens a Callsign longer than 6', () => {
    const row = effectiveNames(MM, 'GB3GLAS', 'Glasgow');
    expect(row.effective.length).toBeLessThanOrEqual(6);
  });
  it('falls back to the usual name without a Callsign', () => {
    const row = effectiveNames(MM, '', 'Calling');
    expect(row.effective).toBe(effectiveNames('radio-io-rt95', '', 'Calling').effective);
  });
  it('lets a build wireName override win', () => {
    expect(effectiveNames(MM, 'GB3GL', 'Glasgow', 'MINE').effective).toBe('MINE');
  });
  it('leaves the stock RT95 profile on the composed name', () => {
    const stock = effectiveNames('radio-io-rt95', 'GB3GL', 'Glasgow');
    expect(stock.suggestion).not.toBe('GB3GL');
  });
});
