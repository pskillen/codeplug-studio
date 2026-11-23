import { describe, expect, it } from 'vitest';
import { DM1701_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-1701-radiofoundry/limits.ts';
import { RT84_RADIOFOUNDRY_BOARD } from '@core/radios/retevis/rt84-radiofoundry/limits.ts';
import { MD9600_RADIOFOUNDRY_BOARD } from '@core/radios/tyt/md-9600-radiofoundry/limits.ts';
import { DM32UV_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { getProfileExportLimits } from '../../profileExportLimits.ts';
import {
  DEFAULT_RADIOFOUNDRY_PROFILE_ID,
  RADIOFOUNDRY_PROFILES,
  isRadioFoundryRadioIoProfileId,
  radioFoundryPowerLadder,
  resolveRadioFoundryProfile,
} from './profiles.ts';

describe('resolveRadioFoundryProfile', () => {
  it('lands the codec id, the radio-io id and no id on the same row', () => {
    const row = RADIOFOUNDRY_PROFILES[0]!;
    expect(resolveRadioFoundryProfile('radiofoundry-dm32uv')).toBe(row);
    expect(resolveRadioFoundryProfile('radio-io-dm32uv-radiofoundry')).toBe(row);
    expect(resolveRadioFoundryProfile(undefined)).toBe(row);
    expect(row.id).toBe(DEFAULT_RADIOFOUNDRY_PROFILE_ID);
    expect(row.board).toBe(DM32UV_RADIOFOUNDRY_BOARD);
  });

  it('throws on an unknown id', () => {
    expect(() => resolveRadioFoundryProfile('radio-io-dm32uv')).toThrow(/Unknown RadioFoundry/);
  });
});

describe('isRadioFoundryRadioIoProfileId', () => {
  it('recognises the RadioFoundry cable id only', () => {
    expect(isRadioFoundryRadioIoProfileId('radio-io-dm32uv-radiofoundry')).toBe(true);
    expect(isRadioFoundryRadioIoProfileId('radio-io-dm1701-radiofoundry')).toBe(true);
    expect(isRadioFoundryRadioIoProfileId('radio-io-rt84-radiofoundry')).toBe(true);
    expect(isRadioFoundryRadioIoProfileId('radio-io-md9600-radiofoundry')).toBe(true);
    expect(isRadioFoundryRadioIoProfileId('radio-io-dm32uv')).toBe(false);
    expect(isRadioFoundryRadioIoProfileId('radio-io-opengd77-1701')).toBe(false);
  });
});

describe('DM-1701 RadioFoundry profile facts', () => {
  it('resolves from radio-io id and keeps five power wires', () => {
    const profile = resolveRadioFoundryProfile('radio-io-dm1701-radiofoundry');
    expect(profile.id).toBe('radiofoundry-dm1701');
    expect(profile.powerLadder.map((e) => e.wire)).toEqual(['1', '3', '6', '8', '10']);
    expect(profile.powerLadder.map((e) => e.approxWatts)).toEqual(
      DM1701_RADIOFOUNDRY_BOARD.POWER_LABELS,
    );
    expect(DEFAULT_RADIOFOUNDRY_PROFILE_ID).toBe('radiofoundry-dm32uv');
  });
});

describe('RT84 RadioFoundry profile facts', () => {
  it('resolves from radio-io id and keeps five power wires', () => {
    const profile = resolveRadioFoundryProfile('radio-io-rt84-radiofoundry');
    expect(profile.id).toBe('radiofoundry-rt84');
    expect(profile.powerLadder.map((e) => e.wire)).toEqual(['1', '3', '6', '8', '10']);
    expect(profile.powerLadder.map((e) => e.approxWatts)).toEqual(
      RT84_RADIOFOUNDRY_BOARD.POWER_LABELS,
    );
    expect(DEFAULT_RADIOFOUNDRY_PROFILE_ID).toBe('radiofoundry-dm32uv');
  });
});

describe('MD-9600 RadioFoundry profile facts', () => {
  it('resolves from radio-io id and keeps five power wires', () => {
    const profile = resolveRadioFoundryProfile('radio-io-md9600-radiofoundry');
    expect(profile.id).toBe('radiofoundry-md9600');
    expect(profile.powerLadder.map((e) => e.wire)).toEqual(['1', '3', '6', '8', '10']);
    expect(profile.powerLadder.map((e) => e.approxWatts)).toEqual(
      MD9600_RADIOFOUNDRY_BOARD.POWER_LABELS,
    );
    expect(DEFAULT_RADIOFOUNDRY_PROFILE_ID).toBe('radiofoundry-dm32uv');
  });
});

describe('radioFoundryCodecProfile', () => {
  it('builds the DM-32UV codec profile it had before', () => {
    const row = RADIOFOUNDRY_PROFILES[0]!;
    expect(row).toEqual({
      id: 'radiofoundry-dm32uv',
      label: 'RadioFoundry codeplug',
      defaultFileName: row.defaultFileName,
      maxChannels: 1024,
      maxZones: 68,
      zoneMembers: 80,
      maxContacts: 1024,
      maxRxGroupLists: 76,
      rxGroupListMembers: 32,
      nameLimit: 16,
      radioNameLimit: 8,
      maxRadioIds: 1,
      dmrIdMax: 16_776_415,
      powerLevels: 9,
      radioIoProfileId: 'radio-io-dm32uv-radiofoundry',
      board: DM32UV_RADIOFOUNDRY_BOARD,
      powerLadder: row.powerLadder,
    });
    expect(row.powerLadder.map((e) => e.wire)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(DEFAULT_RADIOFOUNDRY_PROFILE_ID).toBe('radiofoundry-dm32uv');
  });
});

describe('DM-32UV RadioFoundry profile facts', () => {
  it('keeps the nine equal power steps', () => {
    const ladder = radioFoundryPowerLadder(9);
    expect(ladder.map((entry) => entry.percent)).toEqual([1, 12, 23, 34, 45, 56, 67, 78, 100]);
    expect(ladder.map((entry) => entry.wire)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);
    expect(RADIOFOUNDRY_PROFILES[0]!.powerLadder).toEqual(ladder);
    expect(ladder.every((entry) => entry.approxWatts === undefined)).toBe(true);
  });

  it('writes the real wire bytes on a five-level ladder', () => {
    const ladder = radioFoundryPowerLadder(5);
    expect(ladder.map((entry) => entry.wire)).toEqual(['1', '3', '6', '8', '10']);
  });

  it('fills approxWatts from labels and rejects a wrong-length list', () => {
    const labels = ['a', 'b', 'c', 'd', 'e'];
    expect(radioFoundryPowerLadder(5, labels).map((entry) => entry.approxWatts)).toEqual(labels);
    expect(() => radioFoundryPowerLadder(5, ['a'])).toThrow();
  });

  it('takes the ID database cap from the board', () => {
    expect(
      getProfileExportLimits('radio-io', 'radio-io-dm32uv-radiofoundry')?.maxDigitalIdDatabase,
    ).toBe(287_629);
  });
});
