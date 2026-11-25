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

  it.each([
    ['Low', 25],
    ['Mid', 50],
    ['High', 100],
    ['Turbo', 101],
    ['  Turbo  ', 101],
    ['', null],
    ['  ', null],
    ['turbo', null],
  ])('decodes CSV power %j as %s', (wire, expectedPercent) => {
    expect(anytoneWireToPercent('anytone-at-d890uv', wire)).toBe(expectedPercent);
  });

  it.each([
    [null, 'High'],
    [0, 'Low'],
    [5, 'Low'],
    [25, 'Low'],
    [37.49, 'Low'],
    [37.5, 'Mid'],
    [40, 'Mid'],
    [50, 'Mid'],
    [62.49, 'Mid'],
    [62.5, 'High'],
    [63, 'High'],
    [75, 'High'],
    [90, 'High'],
    [100, 'High'],
    [101, 'Turbo'],
  ])('encodes library power %s as %s', (power, expectedWire) => {
    expect(anytonePercentToWire('anytone-at-d890uv', power)).toBe(expectedWire);
  });

  it('throws for unknown profile', () => {
    expect(() => getAnytoneProfile('unknown')).toThrow(/Unknown Anytone profile/);
    expect(() => anytonePercentToWire('unknown', 101)).toThrow(/Unknown Anytone profile/);
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
    expect(resolveAnytoneCpsProfileId('radio-io-at-d890uv-mm9pdy')).toBe('anytone-at-d890uv');
    expect(getAnytoneProfile('radio-io-at-d890uv').id).toBe('anytone-at-d890uv');
  });
});
