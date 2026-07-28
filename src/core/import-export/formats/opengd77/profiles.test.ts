import { describe, expect, it } from 'vitest';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { percentToWire, wireToPercent } from '../../profileLadder.ts';
import { getOpenGd77Profile, opengd77PercentToWire, opengd77WireToPercent } from './profiles.ts';

describe('profileLadder', () => {
  it('maps exact wire to percent', () => {
    const profile = getOpenGd77Profile('opengd77-1701');
    expect(wireToPercent(profile, 'P9')).toBe(100);
    expect(wireToPercent(profile, 'P2')).toBe(5);
    expect(wireToPercent(profile, '')).toBeNull();
    expect(wireToPercent(profile, 'unknown')).toBeNull();
  });

  it('maps percent to nearest ladder wire', () => {
    const profile = getOpenGd77Profile('opengd77-1701');
    expect(percentToWire(profile, 100)).toBe('P9');
    expect(percentToWire(profile, 82)).toBe('P8');
    expect(percentToWire(profile, null)).toBe('P9');
  });
});

describe('OpenGD77 power ladder', () => {
  it('round-trips 1701 P-levels', () => {
    expect(opengd77WireToPercent('opengd77-1701', 'P9')).toBe(100);
    expect(opengd77WireToPercent('opengd77-1701', 'P2')).toBe(5);
    expect(opengd77WireToPercent('opengd77-1701', 'Master')).toBeNull();
    expect(opengd77PercentToWire('opengd77-1701', 100)).toBe('P9');
    expect(opengd77PercentToWire('opengd77-1701', null)).toBe('Master');
  });

  it('round-trips MD9600 P-levels', () => {
    expect(opengd77WireToPercent('opengd77-md9600', 'P9')).toBe(100);
    expect(opengd77WireToPercent('opengd77-md9600', 'P8')).toBe(63);
    expect(opengd77WireToPercent('opengd77-md9600', 'P2')).toBe(2);
    expect(opengd77WireToPercent('opengd77-md9600', 'P1')).toBe(1);
    expect(opengd77WireToPercent('opengd77-md9600', 'Master')).toBeNull();
    expect(opengd77PercentToWire('opengd77-md9600', 100)).toBe('P9');
    expect(opengd77PercentToWire('opengd77-md9600', 63)).toBe('P8');
    expect(opengd77PercentToWire('opengd77-md9600', 3)).toBe('P3');
    expect(opengd77PercentToWire('opengd77-md9600', null)).toBe('Master');
  });

  it('maps MD9600 nearest percent to ladder wire', () => {
    const profile = getOpenGd77Profile('opengd77-md9600');
    expect(percentToWire(profile, 80)).toBe('P8');
    expect(percentToWire(profile, 20)).toBe('P7');
    expect(percentToWire(profile, 10)).toBe('P6');
    expect(percentToWire(profile, null)).toBe('P9');
  });

  it('imports shared entity caps from OPENGD77_FAMILY_LIMITS', () => {
    for (const profileId of ['opengd77-1701', 'opengd77-md9600'] as const) {
      const profile = getOpenGd77Profile(profileId);
      expect(profile.maxChannels).toBe(OPENGD77_FAMILY_LIMITS.CHANNEL_MAX);
      expect(profile.maxZones).toBe(OPENGD77_FAMILY_LIMITS.ZONE_MAX);
      expect(profile.maxRxGroupLists).toBe(OPENGD77_FAMILY_LIMITS.RX_GROUP_LISTS_MAX);
      expect(profile.maxContacts).toBe(OPENGD77_FAMILY_LIMITS.CONTACTS_MAX);
      expect(profile.zoneMembers).toBe(OPENGD77_FAMILY_LIMITS.ZONE_MEMBERS_MAX);
      expect(profile.tgListMembers).toBe(OPENGD77_FAMILY_LIMITS.RX_GROUP_MEMBERS_MAX);
      expect(profile.rxGroupListNameLimit).toBe(OPENGD77_FAMILY_LIMITS.RX_GROUP_NAME_LEN);
    }
  });

  it('exposes shared entity caps on OpenGD77 profiles', () => {
    for (const profileId of ['opengd77-1701', 'opengd77-md9600'] as const) {
      const profile = getOpenGd77Profile(profileId);
      expect(profile.maxZones).toBe(68);
      expect(profile.maxRxGroupLists).toBe(76);
      expect(profile.maxContacts).toBe(1024);
    }
  });

  it('throws for unknown profile', () => {
    expect(() => getOpenGd77Profile('unknown')).toThrow(/Unknown OpenGD77 profile/);
  });
});
