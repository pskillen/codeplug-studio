import { describe, expect, it } from 'vitest';
import { newChannel } from './factories.ts';
import { defaultModeProfile } from './modeProfiles.ts';
import {
  inferDmrOperatingMode,
  normalizeDmrOperatingMode,
  resolveDmrOperatingMode,
} from './dmrOperatingMode.ts';

describe('dmrOperatingMode', () => {
  it('normalizes known values and rejects unknown', () => {
    expect(normalizeDmrOperatingMode('dmo-simplex')).toBe('dmo-simplex');
    expect(normalizeDmrOperatingMode('repeater')).toBe('repeater');
    expect(normalizeDmrOperatingMode(null)).toBeNull();
    expect(normalizeDmrOperatingMode('invalid')).toBeNull();
  });

  it('infers simplex when RX equals TX', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
    };
    expect(inferDmrOperatingMode(channel)).toBe('dmo-simplex');
  });

  it('infers repeater when RX differs from TX', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      rxFrequency: 145_600_000,
      txFrequency: 145_000_000,
    };
    expect(inferDmrOperatingMode(channel)).toBe('repeater');
  });

  it('infers simplex when either frequency is null', () => {
    const channel = { ...newChannel('proj', 'Test'), rxFrequency: 145_000_000, txFrequency: null };
    expect(inferDmrOperatingMode(channel)).toBe('dmo-simplex');
  });

  it('uses explicit profile dmrMode over inference', () => {
    const channel = {
      ...newChannel('proj', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [{ ...defaultModeProfile('dmr'), dmrMode: 'repeater' as const }],
    };
    expect(resolveDmrOperatingMode(channel)).toBe('repeater');
  });
});
