import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { D890_MAP } from './constants.ts';
import {
  radioIdAddress,
  receiveGroupAddress,
  scanListAddress,
  talkgroupAddress,
  zoneChannelsAddress,
  zoneNameAddress,
} from './memory.ts';
import { atD890RegionLabel, atD890WriteRole } from './writeRole.ts';

describe('atD890RegionLabel / atD890WriteRole', () => {
  it('labels LocalInfo as kept', () => {
    expect(atD890RegionLabel(D890_MAP.LocalInfo)).toBe('Local info');
    expect(atD890WriteRole(D890_MAP.LocalInfo)).toBe('kept');
  });

  it('classifies zone names despite ZonesName > ZoneAChannel (non-monotonic map)', () => {
    const addr = zoneNameAddress(0);
    expect(addr).toBe(D890_MAP.ZonesName);
    expect(addr).toBeGreaterThan(D890_MAP.ZoneAChannel);
    expect(atD890RegionLabel(addr)).toBe('Zone names');
    expect(atD890WriteRole(addr)).toBe('replaced');
    expect(atD890RegionLabel(zoneNameAddress(12))).toBe('Zone names');
    expect(atD890WriteRole(zoneNameAddress(12))).toBe('replaced');
  });

  it('classifies zone membership', () => {
    expect(atD890RegionLabel(zoneChannelsAddress(3))).toBe('Zone membership');
    expect(atD890WriteRole(zoneChannelsAddress(3))).toBe('replaced');
  });

  it('classifies talk groups despite TalkgroupData > ReceiveGroupSet', () => {
    const addr = talkgroupAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.ReceiveGroupSet);
    expect(atD890RegionLabel(addr)).toBe('Talk groups');
    expect(atD890WriteRole(addr)).toBe('replaced');
    expect(talkgroupAddress(1)).toBe(D890_MAP.TalkgroupData + 0xc8);
    expect(atD890RegionLabel(talkgroupAddress(9))).toBe('Talk groups');
    expect(talkgroupAddress(1000)).toBe(0x3a8_0000);
    expect(atD890RegionLabel(talkgroupAddress(1000))).toBe('Talk groups');
    expect(atD890WriteRole(talkgroupAddress(1000))).toBe('replaced');
    expect(talkgroupAddress(4000)).toBe(0x3c0_0000);
    expect(atD890RegionLabel(talkgroupAddress(4000))).toBe('Talk groups');
    expect(atD890WriteRole(talkgroupAddress(4000))).toBe('replaced');
    expect(atD890RegionLabel(0x3a4_0000)).toBe('Talk groups');
    expect(atD890WriteRole(0x3a4_0000)).toBe('replaced');
  });

  it('classifies RX groups despite ReceiveGroupData > MasterIdData', () => {
    const addr = receiveGroupAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.MasterIdData);
    expect(atD890RegionLabel(addr)).toBe('RX group lists');
    expect(atD890WriteRole(addr)).toBe('replaced');
  });

  it('classifies operator radio IDs despite RadioIdData > ScanListData', () => {
    const addr = radioIdAddress(0);
    expect(addr).toBeGreaterThan(D890_MAP.ScanListData);
    expect(atD890RegionLabel(addr)).toBe('Operator radio IDs');
    expect(atD890WriteRole(addr)).toBe('replaced');
  });

  it('classifies bank 1 scan lists as replaced', () => {
    expect(scanListAddress(32)).toBe(0x218_0000);
    expect(atD890RegionLabel(scanListAddress(32))).toBe('Scan lists');
    expect(atD890WriteRole(scanListAddress(32))).toBe('replaced');
    expect(atD890WriteRole(0x210_4000)).toBe('kept');
  });

  it('classifies TalkgroupOrder as replaced when talk groups are rewritten', () => {
    expect(atD890RegionLabel(D890_MAP.TalkgroupOrder)).toBe('Talk group order');
    expect(atD890WriteRole(D890_MAP.TalkgroupOrder)).toBe('replaced');
  });

  it('classifies every talkgroup position-table address as replaced', () => {
    const last = D890_MAP.TalkgroupPosition + (AT_D890UV_LIMITS.TALK_GROUPS_MAX - 1) * 4;
    expect(atD890RegionLabel(D890_MAP.TalkgroupPosition)).toBe('Talk group position table');
    expect(atD890WriteRole(D890_MAP.TalkgroupPosition)).toBe('replaced');
    expect(atD890RegionLabel(D890_MAP.TalkgroupPosition + 4)).toBe('Talk group position table');
    expect(atD890WriteRole(D890_MAP.TalkgroupPosition + 4)).toBe('replaced');
    expect(atD890RegionLabel(last)).toBe('Talk group position table');
    expect(atD890WriteRole(last)).toBe('replaced');
    expect(atD890WriteRole(0x394_0000)).toBe('kept');
    expect(atD890RegionLabel(0x394_0000)).toBe('Other retained region');
  });
});
