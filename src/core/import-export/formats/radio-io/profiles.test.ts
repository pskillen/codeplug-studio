import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { getAnytoneProfile } from '../anytone/profiles.ts';
import { getDm32Profile } from '../dm32/profiles.ts';
import { getOpenGd77Profile } from '../opengd77/profiles.ts';
import {
  getRadioIoProfile,
  isRadioIoAtD890uvProfile,
  isRadioIoDm32uvProfile,
  isRadioIoOpenGd771701Profile,
} from './profiles.ts';

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

  it('keeps radio-io-opengd77-1701 caps aligned with opengd77-1701 CSV profile', () => {
    const radioIo = getRadioIoProfile('radio-io-opengd77-1701');
    const csv = getOpenGd77Profile('opengd77-1701');
    expect(isRadioIoOpenGd771701Profile(radioIo)).toBe(true);
    if (!isRadioIoOpenGd771701Profile(radioIo)) return;
    expect(radioIo.maxMemorySlots).toBe(csv.maxChannels);
    expect(radioIo.maxZones).toBe(csv.maxZones);
    expect(radioIo.maxRxGroupLists).toBe(csv.maxRxGroupLists);
    expect(radioIo.zoneMembers).toBe(csv.zoneMembers);
    expect(radioIo.rxGroupListMembers).toBe(csv.tgListMembers);
    expect(radioIo.nameLimit).toBe(OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG);
  });

  it('keeps radio-io-at-d890uv caps aligned with anytone-at-d890uv CSV profile', () => {
    const radioIo = getRadioIoProfile('radio-io-at-d890uv');
    const csv = getAnytoneProfile('anytone-at-d890uv');
    expect(isRadioIoAtD890uvProfile(radioIo)).toBe(true);
    if (!isRadioIoAtD890uvProfile(radioIo)) return;
    expect(radioIo.maxMemorySlots).toBe(csv.maxChannels);
    expect(radioIo.maxZones).toBe(csv.maxZones);
    expect(radioIo.maxScanLists).toBe(csv.maxScanLists);
    expect(radioIo.maxTalkGroups).toBe(csv.maxTalkGroups);
    expect(radioIo.maxRxGroupLists).toBe(csv.maxRxGroupLists);
    expect(radioIo.nameLimit).toBe(AT_D890UV_LIMITS.NAME_LENGTH);
  });
});
