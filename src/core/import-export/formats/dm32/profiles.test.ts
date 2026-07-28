import { describe, expect, it } from 'vitest';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { percentToWire, wireToPercent } from '../../profileLadder.ts';
import {
  dm32PercentToSquelchWire,
  dm32PercentToWire,
  dm32SquelchWireToPercent,
  dm32WireToPercent,
  getDm32Profile,
} from './profiles.ts';

describe('profileLadder (DM32)', () => {
  it('maps exact power wire to percent', () => {
    const profile = getDm32Profile('dm32-baofeng-dm32uv');
    expect(wireToPercent(profile, 'High')).toBe(100);
    expect(wireToPercent(profile, 'Middle')).toBe(50);
    expect(wireToPercent(profile, 'Low')).toBe(20);
    expect(wireToPercent(profile, '')).toBeNull();
    expect(wireToPercent(profile, 'unknown')).toBeNull();
  });

  it('maps percent to nearest power wire', () => {
    const profile = getDm32Profile('dm32-baofeng-dm32uv');
    expect(percentToWire(profile, 100)).toBe('High');
    expect(percentToWire(profile, 55)).toBe('Middle');
    expect(percentToWire(profile, null)).toBe('High');
  });
});

describe('DM32 power ladder', () => {
  it('round-trips High/Middle/Low', () => {
    expect(dm32WireToPercent('dm32-baofeng-dm32uv', 'High')).toBe(100);
    expect(dm32WireToPercent('dm32-baofeng-dm32uv', 'Low')).toBe(20);
    expect(dm32PercentToWire('dm32-baofeng-dm32uv', 100)).toBe('High');
    expect(dm32PercentToWire('dm32-baofeng-dm32uv', null)).toBe('High');
  });

  it('throws for unknown profile', () => {
    expect(() => getDm32Profile('unknown')).toThrow(/Unknown DM32 profile/);
  });
});

describe('DM32 squelch ladder', () => {
  it('round-trips squelch levels 0–9', () => {
    expect(dm32SquelchWireToPercent('dm32-baofeng-dm32uv', '0')).toBe(0);
    expect(dm32SquelchWireToPercent('dm32-baofeng-dm32uv', '9')).toBe(100);
    expect(dm32PercentToSquelchWire('dm32-baofeng-dm32uv', 100)).toBe('9');
    expect(dm32PercentToSquelchWire('dm32-baofeng-dm32uv', null)).toBe('0');
  });
});

describe('DM32 profile limits SoT', () => {
  it('imports cardinality from DM32UV_LIMITS', () => {
    const profile = getDm32Profile('dm32-baofeng-dm32uv');
    expect(profile.maxChannels).toBe(DM32UV_LIMITS.CHANNEL_MAX);
    expect(profile.maxZones).toBe(DM32UV_LIMITS.ZONE_MAX);
    expect(profile.zoneMembers).toBe(DM32UV_LIMITS.ZONE_MEMBERS_MAX);
    expect(profile.maxScanLists).toBe(DM32UV_LIMITS.SCAN_LISTS_MAX);
    expect(profile.scanListMembers).toBe(DM32UV_LIMITS.SCAN_LIST_MEMBERS_MAX);
    expect(profile.maxRxGroupLists).toBe(DM32UV_LIMITS.RX_GROUPS_MAX);
    expect(profile.rxGroupListMembers).toBe(DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX);
    expect(profile.maxContacts).toBe(DM32UV_LIMITS.CONTACTS_MAX);
    expect(profile.maxTalkGroups).toBe(DM32UV_LIMITS.TALK_GROUPS_MAX);
    expect(profile.maxRadioIds).toBe(DM32UV_LIMITS.RADIO_IDS_MAX);
    expect(profile.nameLimit).toBe(DM32UV_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG);
    expect(profile.scanListNameLimit).toBe(DM32UV_LIMITS.NAME_LENGTH_SCAN_LIST);
    expect(profile.rxGroupListNameLimit).toBe(DM32UV_LIMITS.NAME_LENGTH_RX_GROUP_LIST);
  });
});
