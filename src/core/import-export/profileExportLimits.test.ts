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
    { profileId: 'chirp-uv5r', maxChannels: 128, nameLengthChannel: 7 },
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
});
