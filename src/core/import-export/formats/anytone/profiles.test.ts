import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import {
  ANYTONE_PROFILES,
  anytonePercentToWire,
  anytoneWireToPercent,
  getAnytoneProfile,
  resolveAnytoneCpsProfileId,
} from './profiles.ts';

describe('anytone profiles', () => {
  it('lists at-d890uv profile', () => {
    expect(ANYTONE_PROFILES.map((p) => p.id)).toEqual(['anytone-at-d890uv']);
  });

  it('round-trips power ladder for all four wire values', () => {
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Turbo')).toBe(100);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'High')).toBe(75);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Mid')).toBe(50);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Low')).toBe(25);

    expect(anytonePercentToWire('anytone-at-d890uv', 100)).toBe('Turbo');
    expect(anytonePercentToWire('anytone-at-d890uv', 75)).toBe('High');
    expect(anytonePercentToWire('anytone-at-d890uv', 50)).toBe('Mid');
    expect(anytonePercentToWire('anytone-at-d890uv', 25)).toBe('Low');
  });

  it('maps nearest percent and null to Turbo', () => {
    expect(anytonePercentToWire('anytone-at-d890uv', null)).toBe('Turbo');
    expect(anytonePercentToWire('anytone-at-d890uv', 5)).toBe('Low');
    expect(anytonePercentToWire('anytone-at-d890uv', 40)).toBe('Mid');
    expect(anytonePercentToWire('anytone-at-d890uv', 63)).toBe('High');
    expect(anytonePercentToWire('anytone-at-d890uv', 90)).toBe('Turbo');
  });

  it('throws for unknown profile', () => {
    expect(() => getAnytoneProfile('unknown')).toThrow(/Unknown Anytone profile/);
  });

  it('imports org caps from AT_D890UV_LIMITS', () => {
    const profile = getAnytoneProfile('anytone-at-d890uv');
    expect(profile.maxChannels).toBe(AT_D890UV_LIMITS.CHANNEL_MAX);
    expect(profile.maxZones).toBe(AT_D890UV_LIMITS.ZONE_MAX);
    expect(profile.zoneMembers).toBe(AT_D890UV_LIMITS.ZONE_MEMBERS_MAX);
    expect(profile.maxScanLists).toBe(AT_D890UV_LIMITS.SCAN_LISTS_MAX);
    expect(profile.scanListMembers).toBe(AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX);
    expect(profile.maxRxGroupLists).toBe(AT_D890UV_LIMITS.RX_GROUP_LISTS_MAX);
    expect(profile.rxGroupListMembers).toBe(AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX);
    expect(profile.maxTalkGroups).toBe(AT_D890UV_LIMITS.TALK_GROUPS_MAX);
    expect(profile.maxAprsSlots).toBe(AT_D890UV_LIMITS.APRS_SLOTS);
  });

  it('resolves Web Serial sibling profile to Anytone CSV caps', () => {
    expect(resolveAnytoneCpsProfileId('radio-io-at-d890uv')).toBe('anytone-at-d890uv');
    expect(getAnytoneProfile('radio-io-at-d890uv').id).toBe('anytone-at-d890uv');
  });
});
