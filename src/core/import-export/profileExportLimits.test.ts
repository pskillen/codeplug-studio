import { describe, expect, it } from 'vitest';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';

describe('getProfileExportLimits', () => {
  it('maps OpenGD77 known fields and leaves entity counts blank', () => {
    const limits = getProfileExportLimits('opengd77', 'opengd77-1701');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(1023);
    expect(limits!.zoneMembers).toBe(80);
    expect(limits!.rxGroupListMembers).toBe(32);
    expect(limits!.nameLengthChannel).toBe(16);
    expect(limits!.maxZones).toBeNull();
    expect(limits!.maxContacts).toBeNull();
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.scanListMembers).toBe('not_used');
    expect(limits!.powerLadder.length).toBeGreaterThan(0);
    expect(limits!.siblingLadders).toEqual([]);
  });

  it('maps DM32 entity caps, member caps, name lengths, and squelch ladder', () => {
    const limits = getProfileExportLimits('dm32', 'dm32-baofeng-dm32uv');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(4000);
    expect(limits!.maxZones).toBe(250);
    expect(limits!.maxScanLists).toBe(32);
    expect(limits!.maxRxGroupLists).toBe(32);
    expect(limits!.maxContacts).toBe(250);
    expect(limits!.maxTalkGroups).toBe(800);
    expect(limits!.zoneMembers).toBe(64);
    expect(limits!.scanListMembers).toBe(15);
    expect(limits!.rxGroupListMembers).toBe(32);
    expect(limits!.nameLengthChannel).toBe(16);
    expect(limits!.nameLengthZone).toBe(16);
    expect(limits!.nameLengthContact).toBe(16);
    expect(limits!.nameLengthTalkGroup).toBe(16);
    expect(limits!.nameLengthScanList).toBe(10);
    expect(limits!.nameLengthRxGroupList).toBe(10);
    expect(limits!.siblingLadders).toHaveLength(1);
    expect(limits!.siblingLadders[0]?.label).toBe('Squelch');
  });

  it('maps Anytone scan list count and member caps', () => {
    const limits = getProfileExportLimits('anytone', 'anytone-at-d890uv');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(4000);
    expect(limits!.maxScanLists).toBe(100);
    expect(limits!.zoneMembers).toBe(64);
    expect(limits!.scanListMembers).toBe(100);
    expect(limits!.rxGroupListMembers).toBe(32);
    expect(limits!.maxZones).toBeNull();
    expect(limits!.maxContacts).toBeNull();
  });

  it.each([
    { profileId: 'chirp-uv5r', maxChannels: 999, nameLengthChannel: 12 },
    { profileId: 'chirp-uv21', maxChannels: 128, nameLengthChannel: 16 },
    { profileId: 'chirp-rt95', maxChannels: 128, nameLengthChannel: 16 },
  ] as const)(
    'marks $profileId organisation limits as not used with profile memory/name caps',
    ({ profileId, maxChannels, nameLengthChannel }) => {
      const limits = getProfileExportLimits('chirp', profileId);
      expect(limits).not.toBeNull();
      expect(limits!.maxChannels).toBe(maxChannels);
      expect(limits!.nameLengthChannel).toBe(nameLengthChannel);
      expect(limits!.maxZones).toBe('not_used');
      expect(limits!.maxScanLists).toBe('not_used');
      expect(limits!.maxRxGroupLists).toBe('not_used');
      expect(limits!.maxContacts).toBe('not_used');
      expect(limits!.maxTalkGroups).toBe('not_used');
      expect(limits!.zoneMembers).toBe('not_used');
      expect(limits!.scanListMembers).toBe('not_used');
      expect(limits!.rxGroupListMembers).toBe('not_used');
      expect(limits!.nameLengthZone).toBe('not_used');
      expect(limits!.nameLengthContact).toBe('not_used');
      expect(limits!.nameLengthTalkGroup).toBe('not_used');
      expect(limits!.nameLengthScanList).toBe('not_used');
      expect(limits!.nameLengthRxGroupList).toBe('not_used');
      expect(limits!.powerLadder.length).toBeGreaterThan(0);
      expect(limits!.siblingLadders).toEqual([]);
    },
  );

  it('returns null for unknown profile', () => {
    expect(getProfileExportLimits('opengd77', 'does-not-exist')).toBeNull();
  });

  it('maps NeonPlug DM32UV caps identically to DM32 CPS profile', () => {
    const limits = getProfileExportLimits('neonplug', 'neonplug-dm32uv');
    const dm32 = getProfileExportLimits('dm32', 'dm32-baofeng-dm32uv');
    expect(limits).not.toBeNull();
    expect(dm32).not.toBeNull();
    expect(limits!.maxChannels).toBe(dm32!.maxChannels);
    expect(limits!.maxZones).toBe(dm32!.maxZones);
    expect(limits!.maxScanLists).toBe(dm32!.maxScanLists);
    expect(limits!.maxRxGroupLists).toBe(dm32!.maxRxGroupLists);
    expect(limits!.maxContacts).toBe(dm32!.maxContacts);
    expect(limits!.maxTalkGroups).toBe(dm32!.maxTalkGroups);
    expect(limits!.zoneMembers).toBe(dm32!.zoneMembers);
    expect(limits!.scanListMembers).toBe(dm32!.scanListMembers);
    expect(limits!.rxGroupListMembers).toBe(dm32!.rxGroupListMembers);
    expect(limits!.nameLengthChannel).toBe(dm32!.nameLengthChannel);
    expect(limits!.nameLengthZone).toBe(dm32!.nameLengthZone);
    expect(limits!.nameLengthContact).toBe(dm32!.nameLengthContact);
    expect(limits!.nameLengthTalkGroup).toBe(dm32!.nameLengthTalkGroup);
    expect(limits!.nameLengthScanList).toBe(dm32!.nameLengthScanList);
    expect(limits!.nameLengthRxGroupList).toBe(dm32!.nameLengthRxGroupList);
    expect(limits!.siblingLadders).toHaveLength(1);
  });

  it('marks NeonPlug UV5R-Mini organisation limits as not used with binary memory/name caps', () => {
    const limits = getProfileExportLimits('neonplug', 'neonplug-uv5rmini');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(999);
    expect(limits!.nameLengthChannel).toBe(12);
    expect(limits!.maxZones).toBe('not_used');
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.maxRxGroupLists).toBe('not_used');
    expect(limits!.maxContacts).toBe('not_used');
    expect(limits!.maxTalkGroups).toBe('not_used');
    expect(limits!.zoneMembers).toBe('not_used');
    expect(limits!.scanListMembers).toBe('not_used');
    expect(limits!.rxGroupListMembers).toBe('not_used');
    expect(limits!.nameLengthZone).toBe('not_used');
    expect(limits!.nameLengthContact).toBe('not_used');
    expect(limits!.nameLengthTalkGroup).toBe('not_used');
    expect(limits!.nameLengthScanList).toBe('not_used');
    expect(limits!.nameLengthRxGroupList).toBe('not_used');
    expect(limits!.powerLadder.length).toBeGreaterThan(0);
    expect(limits!.siblingLadders).toEqual([]);
  });
});
