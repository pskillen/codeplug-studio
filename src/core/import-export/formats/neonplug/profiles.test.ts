import { describe, expect, it } from 'vitest';
import { getChirpProfile } from '../chirp/profiles.ts';
import { getDm32Profile } from '../dm32/profiles.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  NEONPLUG_PROFILES,
  neonplugPercentToWire,
  neonplugWireToPercent,
} from './profiles.ts';

describe('neonplug profiles', () => {
  it('registers dm32uv and uv5rmini profiles', () => {
    expect(NEONPLUG_PROFILES.map((p) => p.id)).toEqual(['neonplug-dm32uv', 'neonplug-uv5rmini']);
  });

  it('keeps neonplug-dm32uv caps identical to dm32-baofeng-dm32uv', () => {
    const neon = getNeonplugProfile('neonplug-dm32uv');
    const dm32 = getDm32Profile('dm32-baofeng-dm32uv');
    expect(isNeonplugDm32uvProfile(neon)).toBe(true);
    if (!isNeonplugDm32uvProfile(neon)) return;

    expect(neon.maxChannels).toBe(dm32.maxChannels);
    expect(neon.maxZones).toBe(dm32.maxZones);
    expect(neon.zoneMembers).toBe(dm32.zoneMembers);
    expect(neon.maxScanLists).toBe(dm32.maxScanLists);
    expect(neon.scanListMembers).toBe(dm32.scanListMembers);
    expect(neon.maxRxGroupLists).toBe(dm32.maxRxGroupLists);
    expect(neon.rxGroupListMembers).toBe(dm32.rxGroupListMembers);
    expect(neon.maxContacts).toBe(dm32.maxContacts);
    expect(neon.maxTalkGroups).toBe(dm32.maxTalkGroups);
    expect(neon.nameLimit).toBe(dm32.nameLimit);
    expect(neon.scanListNameLimit).toBe(dm32.scanListNameLimit);
    expect(neon.rxGroupListNameLimit).toBe(dm32.rxGroupListNameLimit);
  });

  it('aligns UV5R Mini memory/name caps with CHIRP chirp-uv5r', () => {
    const neon = getNeonplugProfile('neonplug-uv5rmini');
    const chirp = getChirpProfile('chirp-uv5r');
    expect(neon.id).toBe('neonplug-uv5rmini');
    if (neon.id !== 'neonplug-uv5rmini') return;

    expect(neon.maxMemorySlots).toBe(999);
    expect(neon.nameLimit).toBe(12);
    expect(chirp.maxMemorySlots).toBe(999);
    expect(chirp.nameLimit).toBe(12);
  });

  it('maps power ladder for dm32uv', () => {
    expect(neonplugWireToPercent('neonplug-dm32uv', 'High')).toBe(100);
    expect(neonplugWireToPercent('neonplug-dm32uv', 'Low')).toBe(20);
    expect(neonplugPercentToWire('neonplug-dm32uv', null)).toBe('High');
  });

  it('throws for unknown profile', () => {
    expect(() => getNeonplugProfile('neonplug-unknown')).toThrow(/Unknown NeonPlug profile/);
  });
});
