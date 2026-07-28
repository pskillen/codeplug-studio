import { describe, expect, it } from 'vitest';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { getDm32Profile } from '../dm32/profiles.ts';
import { getRadioIoProfile, isRadioIoDm32uvProfile } from './profiles.ts';

describe('radio-io profiles', () => {
  it('keeps radio-io-dm32uv caps identical to dm32-baofeng-dm32uv', () => {
    const radioIo = getRadioIoProfile('radio-io-dm32uv');
    const dm32 = getDm32Profile('dm32-baofeng-dm32uv');
    expect(isRadioIoDm32uvProfile(radioIo)).toBe(true);
    if (!isRadioIoDm32uvProfile(radioIo)) return;

    expect(radioIo.maxMemorySlots).toBe(dm32.maxChannels);
    expect(radioIo.maxZones).toBe(dm32.maxZones);
    expect(radioIo.zoneMembers).toBe(dm32.zoneMembers);
    expect(radioIo.maxScanLists).toBe(dm32.maxScanLists);
    expect(radioIo.scanListMembers).toBe(dm32.scanListMembers);
    expect(radioIo.maxRxGroupLists).toBe(dm32.maxRxGroupLists);
    expect(radioIo.rxGroupListMembers).toBe(dm32.rxGroupListMembers);
    expect(radioIo.maxContacts).toBe(dm32.maxContacts);
    expect(radioIo.maxTalkGroups).toBe(dm32.maxTalkGroups);
    expect(radioIo.maxRadioIds).toBe(dm32.maxRadioIds);
    expect(radioIo.nameLimit).toBe(dm32.nameLimit);
    expect(radioIo.scanListNameLimit).toBe(dm32.scanListNameLimit);
    expect(radioIo.rxGroupListNameLimit).toBe(dm32.rxGroupListNameLimit);
  });

  it('imports radio-io-dm32uv cardinality from DM32UV_LIMITS', () => {
    const profile = getRadioIoProfile('radio-io-dm32uv');
    if (!isRadioIoDm32uvProfile(profile)) return;
    expect(profile.maxMemorySlots).toBe(DM32UV_LIMITS.CHANNEL_MAX);
    expect(profile.maxContacts).toBe(DM32UV_LIMITS.CONTACTS_MAX);
    expect(profile.maxTalkGroups).toBe(DM32UV_LIMITS.TALK_GROUPS_MAX);
    expect(profile.maxRadioIds).toBe(DM32UV_LIMITS.RADIO_IDS_MAX);
  });
});
