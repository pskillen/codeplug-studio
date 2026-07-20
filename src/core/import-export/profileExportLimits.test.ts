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

  it('maps DM32 scan caps, scan name length, and squelch ladder', () => {
    const limits = getProfileExportLimits('dm32', 'dm32-baofeng-dm32uv');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(1000);
    expect(limits!.scanListMembers).toBe(15);
    expect(limits!.rxGroupListMembers).toBe(32);
    expect(limits!.nameLengthScanList).toBe(13);
    expect(limits!.zoneMembers).toBeNull();
    expect(limits!.maxZones).toBeNull();
    expect(limits!.maxScanLists).toBeNull();
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

  it('marks CHIRP zone and digital entity limits as not used', () => {
    const limits = getProfileExportLimits('chirp', 'chirp-uv5r');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(128);
    expect(limits!.nameLengthChannel).toBe(7);
    expect(limits!.maxZones).toBe('not_used');
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.maxContacts).toBe('not_used');
    expect(limits!.zoneMembers).toBe('not_used');
    expect(limits!.powerLadder.length).toBeGreaterThan(0);
  });

  it('returns null for unknown profile', () => {
    expect(getProfileExportLimits('opengd77', 'does-not-exist')).toBeNull();
  });
});
