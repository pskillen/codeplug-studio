import { describe, expect, it } from 'vitest';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import { RADIO_IO_PROFILES } from '@core/import-export/formats/radio-io/profiles.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';

describe('getProfileExportLimits', () => {
  it('maps OpenGD77 entity caps and name lengths from profile', () => {
    const limits = getProfileExportLimits('opengd77', 'opengd77-1701');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(1023);
    expect(limits!.maxZones).toBe(68);
    expect(limits!.maxRxGroupLists).toBe(76);
    expect(limits!.maxContacts).toBe(1024);
    expect(limits!.zoneMembers).toBe(80);
    expect(limits!.rxGroupListMembers).toBe(32);
    expect(limits!.nameLengthChannel).toBe(16);
    expect(limits!.nameLengthZone).toBe(16);
    expect(limits!.nameLengthContact).toBe(16);
    expect(limits!.nameLengthTalkGroup).toBe(16);
    expect(limits!.nameLengthRxGroupList).toBe(15);
    expect(limits!.maxTalkGroups).toBe('not_used');
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
    expect(limits!.maxScanLists).toBe(AT_D890UV_LIMITS.SCAN_LISTS_MAX);
    expect(limits!.zoneMembers).toBe(250);
    expect(limits!.scanListMembers).toBe(100);
    expect(limits!.rxGroupListMembers).toBe(64);
    expect(limits!.maxZones).toBe(250);
    expect(limits!.maxRxGroupLists).toBe(250);
    expect(limits!.maxTalkGroups).toBe(10_000);
    // The Contacts list is the talk-group list; the ID database is a separate bank.
    expect(limits!.maxContacts).toBe(AT_D890UV_LIMITS.TALK_GROUPS_MAX);
    expect(limits!.maxDigitalIdDatabase).toBe(AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX);
    expect(limits!.maxRadioIds).toBe(AT_D890UV_LIMITS.RADIO_IDS_MAX);
  });

  it.each([
    { profileId: 'chirp-uv5r', maxChannels: 999, nameLengthChannel: 12 },
    { profileId: 'chirp-uv21', maxChannels: 1000, nameLengthChannel: 12 },
    { profileId: 'chirp-rt95', maxChannels: 200, nameLengthChannel: 6 },
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

  it('marks Direct radio UV-5R Mini organisation limits as not used with binary memory/name caps', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-uv5r-mini');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(999);
    expect(limits!.nameLengthChannel).toBe(12);
    expect(limits!.maxZones).toBe('not_used');
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.powerLadder.map((e) => e.wire)).toEqual(['High', 'Low']);
  });

  it('maps radio-io DM32UV caps identically to DM32 CPS profile', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-dm32uv');
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
    expect(limits!.nameLengthScanList).toBe(dm32!.nameLengthScanList);
    expect(limits!.nameLengthRxGroupList).toBe(dm32!.nameLengthRxGroupList);
  });

  it('projects Anytone AT-D890UV Direct radio limits from radio-io profile', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-at-d890uv');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(4000);
    expect(limits!.nameLengthChannel).toBe(16);
    expect(limits!.maxScanLists).toBe(AT_D890UV_LIMITS.SCAN_LISTS_MAX);
    expect(limits!.scanListMembers).toBe(100);
    expect(limits!.zoneMembers).toBe(250);
    expect(limits!.maxContacts).toBe(AT_D890UV_LIMITS.TALK_GROUPS_MAX);
    expect(limits!.maxDigitalIdDatabase).toBe(AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX);
    expect(limits!.powerLadder.map((e) => e.wire)).toEqual(['Turbo', 'High', 'Mid', 'Low']);
  });

  it('marks MM9PDY DM-32UV scan-list limits not_used', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-dm32uv-mm9pdy');
    const stock = getProfileExportLimits('radio-io', 'radio-io-dm32uv');
    expect(limits).not.toBeNull();
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.scanListMembers).toBe('not_used');
    expect(limits!.nameLengthScanList).toBe('not_used');
    expect(limits!.maxChannels).toBe(stock!.maxChannels);
    expect(stock!.maxScanLists).not.toBe('not_used');
  });

  it('gives the RT95 MM9PDY profile zones and leaves the stock RT95 profile without', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-rt95-mm9pdy');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(200);
    expect(limits!.nameLengthChannel).toBe(6);
    expect(limits!.maxZones).toBe(32);
    expect(limits!.zoneMembers).toBe(200);
    expect(limits!.nameLengthZone).toBe(12);
    for (const key of [
      'maxScanLists',
      'maxRxGroupLists',
      'maxContacts',
      'maxDigitalIdDatabase',
      'maxTalkGroups',
      'maxRadioIds',
    ] as const) {
      expect(limits![key]).toBe('not_used');
    }
    const stock = getProfileExportLimits('radio-io', 'radio-io-rt95');
    expect(stock!.maxZones).toBe('not_used');
    expect(stock!.nameLengthZone).toBe('not_used');
  });

  it('projects DM-32 RadioFoundry cable limits from the radiofoundry profile', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-dm32uv-radiofoundry');
    const file = getProfileExportLimits('radiofoundry', 'radiofoundry-dm32uv');
    expect(limits).not.toBeNull();
    expect(file).not.toBeNull();
    expect(limits!.maxChannels).toBe(file!.maxChannels);
    expect(limits!.maxZones).toBe(file!.maxZones);
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.maxContacts).toBe(file!.maxContacts);
    expect(limits!.maxTalkGroups).toBe('not_used');
    expect(limits!.maxRadioIds).toBe(file!.maxRadioIds);
    expect(limits!.zoneMembers).toBe(file!.zoneMembers);
    expect(limits!.nameLengthChannel).toBe(file!.nameLengthChannel);
    expect(limits!.powerLadder.map((entry) => entry.wire)).toEqual(
      file!.powerLadder.map((entry) => entry.wire),
    );
  });

  it('marks MM9PDY AT-D890UV scan-list limits not_used', () => {
    const limits = getProfileExportLimits('radio-io', 'radio-io-at-d890uv-mm9pdy');
    expect(limits).not.toBeNull();
    expect(limits!.maxChannels).toBe(4000);
    expect(limits!.maxScanLists).toBe('not_used');
    expect(limits!.scanListMembers).toBe('not_used');
    expect(limits!.nameLengthScanList).toBe('not_used');
    expect(limits!.maxRxGroupLists).toBe(
      getProfileExportLimits('radio-io', 'radio-io-at-d890uv')!.maxRxGroupLists,
    );
  });

  describe('digital ID database', () => {
    it.each([
      ['radio-io', 'radio-io-opengd77-1701', OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX],
      ['radio-io', 'radio-io-opengd77-md9600', OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX],
      ['radio-io', 'radio-io-dm32uv', DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX],
      ['radio-io', 'radio-io-dm32uv-mm9pdy', DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX],
      ['radio-io', 'radio-io-dm32uv-radiofoundry', DM32UV_RADIOFOUNDRY_LIMITS.ID_DATABASE_MAX],
      ['radio-io', 'radio-io-at-d890uv', AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX],
      ['radio-io', 'radio-io-at-d890uv-mm9pdy', AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX],
      ['anytone', 'anytone-at-d890uv', AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX],
    ] as const)('%s %s holds its own bank, apart from contacts', (formatId, profileId, cap) => {
      const limits = getProfileExportLimits(formatId, profileId);
      expect(limits!.maxDigitalIdDatabase).toBe(cap);
      expect(limits!.maxDigitalIdDatabase).not.toBe(limits!.maxContacts);
    });

    it.each([
      ['opengd77', 'opengd77-1701'],
      ['opengd77', 'opengd77-md9600'],
      ['dm32', 'dm32-baofeng-dm32uv'],
      ['neonplug', 'neonplug-dm32uv'],
      ['neonplug', 'neonplug-uv5rmini'],
      ['radiofoundry', 'radiofoundry-dm32uv'],
      ['chirp', 'chirp-uv5r'],
      ['chirp', 'chirp-uv21'],
      ['chirp', 'chirp-rt95'],
      ['radio-io', 'radio-io-uv5r-mini'],
      ['radio-io', 'radio-io-uv21'],
      ['radio-io', 'radio-io-rt95'],
      ['radio-io', 'radio-io-rt95-mm9pdy'],
    ] as const)('%s %s has no ID database bank', (formatId, profileId) => {
      expect(getProfileExportLimits(formatId, profileId)!.maxDigitalIdDatabase).toBe('not_used');
    });

    it('gives every profile a defined value, never undefined', () => {
      for (const p of RADIO_IO_PROFILES) {
        const limits = getProfileExportLimits('radio-io', p.id);
        expect(limits).not.toBeNull();
        expect(limits!.maxDigitalIdDatabase).not.toBeUndefined();
      }
    });
  });

  it('shares the OpenGD77 contact bank between contacts and talk groups on Direct radio too', () => {
    for (const id of ['radio-io-opengd77-1701', 'radio-io-opengd77-md9600']) {
      const limits = getProfileExportLimits('radio-io', id)!;
      expect(limits.maxContacts).toBe(OPENGD77_FAMILY_LIMITS.CONTACTS_MAX);
      expect(limits.maxTalkGroups).toBe('not_used');
    }
  });
});
