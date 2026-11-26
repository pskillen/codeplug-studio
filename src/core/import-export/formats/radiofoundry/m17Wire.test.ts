import { describe, expect, it } from 'vitest';
import { expansionWireKey } from '@core/import-export/channelExpansion/modeExportSuffix.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import { newChannel, newOwnDigitalId } from '@core/domain/factories.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import type { Channel, ChannelModeProfileM17, OwnDigitalId } from '@core/models/library.ts';
import { RADIOFOUNDRY_LIMITS } from '@core/radios/radiofoundry/limits.ts';
import { radiofoundryExportAdapter } from './adapter.ts';
import {
  isChannelTagLive,
  RADIOFOUNDRY_KIND_M17,
  writeRadioFoundryChannelTag,
  type ChannelTagHeader,
} from './channelTags.ts';
import {
  CHANNEL_RECORD_SIZE,
  channelSlotAddress,
  SETTINGS_AREA_ADDRESS,
  SETTINGS_AREA_SIZE,
} from './layout.ts';
import { encodeM17CallsignRecord, encodeM17ChannelBlock } from './m17.ts';
import { parseRadioFoundryCodeplug } from './parse.ts';
import {
  materialiseRadioFoundryFileExport,
  RADIOFOUNDRY_FILE_SETTINGS_REPLACED,
  RADIOFOUNDRY_M17_FIRMWARE_NOTE,
  serialiseRadioFoundryCodeplug,
} from './serialise.ts';
import { readRadioFoundrySettingsArea, settingsAreaSector } from './settingsArea.ts';
import { encodeRadioFoundrySettingsSector } from './settingsAreaWrite.ts';

function m17Profile(partial: Partial<ChannelModeProfileM17> = {}): ChannelModeProfileM17 {
  return { mode: 'm17', can: 3, playEveryCan: true, destination: 'ECHO', ...partial };
}

function channel(
  name: string,
  profiles: Channel['modeProfiles'],
  primary?: Channel['primaryMode'],
): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    primaryMode: primary,
    modeProfiles: profiles,
  };
  return { entity, wireName: name };
}

function dmrProfile() {
  return {
    mode: 'dmr' as const,
    colourCode: 1,
    timeslot: 1 as const,
    ownDigitalIdId: null,
    contactRef: null,
    rxGroupListId: null,
  };
}

function ownId(name = 'MM9PDY'): OwnDigitalId {
  return { ...newOwnDigitalId('p', 'dmr', name, 2_351_234), isDefault: true };
}

function m17Id(callsign: string): OwnDigitalId {
  return { ...newOwnDigitalId('p', 'm17', callsign, callsign), isDefault: true };
}

function assembled(overrides: Partial<AssembledBuild> = {}): AssembledBuild {
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [ownId()],
    ...overrides,
  };
}

function fieldText(bytes: Uint8Array, offset: number, length: number): string {
  let end = offset;
  const stop = offset + length;
  while (end < stop && bytes[end] !== 0xff && bytes[end] !== 0x00) end += 1;
  return new TextDecoder().decode(bytes.subarray(offset, end));
}

function tagHeader(channelNumber: number, tag: Uint8Array): ChannelTagHeader {
  return {
    channelNumber,
    kind: tag[0]!,
    system: tag[1] === 0xff ? null : tag[1]!,
    nameCheck: tag[2]! | (tag[3]! << 8),
    txAllowed: (tag[4]! & 0x01) !== 0,
    baseStandsAlone: (tag[4]! & 0x02) !== 0,
  };
}

describe('RadioFoundry M17 export', () => {
  it('writes a DMR receive-only stand-in and a kind-6 tag, and leaves the cable area blank', () => {
    const row = channel('Echo', [m17Profile()]);
    const image = serialiseRadioFoundryCodeplug(assembled({ channels: [row] }));
    const record = channelSlotAddress(1).record;
    expect(image.bytes[record + 0x18]).toBe(1);
    expect(image.bytes[record + 0x28]).toBe(0);
    expect(image.bytes[record + 0x2b]).toBe(0);
    expect(image.bytes[record + 0x2c]).toBe(0);
    expect(image.bytes[record + 0x2e]).toBe(0);
    expect(image.bytes[record + 0x2f]).toBe(0);
    expect(image.bytes[record + 0x31]).toBe(0);
    expect(image.bytes[record + 0x33]! & 0x04).toBe(0x04);
    expect(image.bytes[record + 0x33]! & 0x02).toBe(0);
    const tag = image.m17Settings?.channelTags.get(1);
    expect(tag).toBeDefined();
    if (!tag) return;
    expect(tag[0]).toBe(RADIOFOUNDRY_KIND_M17);
    expect(tag[1]).toBe(0xff);
    expect(tag[4]! & 0xfe).toBe(0);
    expect(tag[4]! & 0x01).toBe(0x01);
    expect([...tag.subarray(5, 12)]).toEqual([...encodeM17ChannelBlock(3, false, 'ECHO')!]);
    expect(
      isChannelTagLive(
        tagHeader(1, tag),
        image.bytes.subarray(record, record + CHANNEL_RECORD_SIZE),
      ),
    ).toBe(true);
    const end = SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE;
    expect(image.bytes.subarray(SETTINGS_AREA_ADDRESS, end).every((b) => b === 0xff)).toBe(true);
    expect(image.owned.subarray(SETTINGS_AREA_ADDRESS, end).every((b) => b === 0)).toBe(true);
    const text = image.warnings.map(formatExportWarning).join('\n');
    expect(text).not.toContain(RADIOFOUNDRY_FILE_SETTINGS_REPLACED);
    expect(text).not.toContain(RADIOFOUNDRY_M17_FIRMWARE_NOTE);
    expect(text).toContain('CAN squelch');
    expect(text).toContain('MM9PDY');
  });

  it('puts a fresh settings sector and the file-only warnings on the file export', () => {
    const row = channel('Echo', [m17Profile()]);
    const file = radiofoundryExportAdapter.serialise(
      assembled({ channels: [row], ownDigitalIds: [ownId(), m17Id('AB1CD')] }),
    );
    const area = readRadioFoundrySettingsArea(settingsAreaSector(file.bytes));
    expect(area.state).toBe('valid');
    expect(area.entries.map((entry) => entry.key)).toEqual([0x0400, 0x0a06]);
    expect([...area.entries[1]!.value]).toEqual([...encodeM17CallsignRecord('AB1CD')!]);
    expect(file.bytes[SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE]).toBe(0xff);
    const owned = serialiseRadioFoundryCodeplug(
      assembled({ channels: [row], ownDigitalIds: [ownId(), m17Id('AB1CD')] }),
    ).owned;
    expect(
      owned
        .subarray(SETTINGS_AREA_ADDRESS, SETTINGS_AREA_ADDRESS + SETTINGS_AREA_SIZE)
        .every((b) => b === 0),
    ).toBe(true);
    const text = file.warnings.map(formatExportWarning).join('\n');
    expect(text).toContain(RADIOFOUNDRY_FILE_SETTINGS_REPLACED);
    expect(text).toContain(RADIOFOUNDRY_M17_FIRMWARE_NOTE);
    expect(text).not.toContain('leaves the RadioFoundry settings area blank');
  });

  it('keeps an erased settings area when the file has no M17 rows', () => {
    const row = channel('Local', [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
    ]);
    const base = serialiseRadioFoundryCodeplug(assembled({ channels: [row] }));
    const file = materialiseRadioFoundryFileExport(base);
    expect(file.bytes).toBe(base.bytes);
    expect(file.warnings).toBe(base.warnings);
  });

  it('lists each mode copy in the zone', () => {
    const row = channel('Repeater', [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      m17Profile(),
    ]);
    const { bytes } = serialiseRadioFoundryCodeplug(
      assembled({
        channels: [row],
        zones: [{ zoneId: 'z', wireName: 'Home', memberChannelIds: [row.entity.id] }],
      }),
    );
    const zone = 0x8010 + 0x20;
    expect(bytes[zone + 16]! | (bytes[zone + 17]! << 8)).toBe(1);
    expect(bytes[zone + 18]! | (bytes[zone + 19]! << 8)).toBe(2);
    expect(fieldText(bytes, channelSlotAddress(2).record, 16)).toBe('Repeater-M17');
  });

  it('warns when the radio name cannot supply a callsign, and describes a valid fallback', () => {
    const row = channel('Echo', [m17Profile()]);
    const invalid = serialiseRadioFoundryCodeplug(
      assembled({ channels: [row], ownDigitalIds: [ownId("Bob's")] }),
    );
    expect(invalid.warnings.map(formatExportWarning).join('\n')).toContain(
      'not a valid M17 callsign',
    );
    expect(invalid.m17Settings?.callsignRecord).toBeUndefined();
    const valid = serialiseRadioFoundryCodeplug(
      assembled({ channels: [row], ownDigitalIds: [ownId('M0ABC-1')] }),
    );
    expect(valid.warnings.map(formatExportWarning).join('\n')).toContain(
      "This radio's name gives M0ABC",
    );
    expect(valid.m17Settings?.callsignRecord).toBeUndefined();
  });

  it('gives every shortened M17 copy its own live tag', () => {
    const long = 'Sixteen chars!!! and more that collides';
    const rows = [0, 1, 2].map(() =>
      channel(long, [
        { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
        m17Profile({ can: 1, playEveryCan: false, destination: '' }),
      ]),
    );
    const image = serialiseRadioFoundryCodeplug(assembled({ channels: rows }));
    const names = [...image.m17Settings!.channelTags.keys()].map((number) =>
      fieldText(image.bytes, channelSlotAddress(number).record, RADIOFOUNDRY_LIMITS.NAME_MAX),
    );
    expect(names.every((name) => name.length <= RADIOFOUNDRY_LIMITS.NAME_MAX)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
    for (const [number, tag] of image.m17Settings!.channelTags) {
      const at = channelSlotAddress(number).record;
      expect(tag.length).toBe(12);
      expect(
        isChannelTagLive(
          tagHeader(number, tag),
          image.bytes.subarray(at, at + CHANNEL_RECORD_SIZE),
        ),
      ).toBe(true);
    }
  });

  it('builds tags only for M17 rows kept after an override', () => {
    const kept = channel('Kept', [m17Profile()]);
    const dropped = channel('Dropped', [
      { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
      m17Profile(),
    ]);
    const image = serialiseRadioFoundryCodeplug(assembled({ channels: [kept, dropped] }), {
      channelOverrides: [
        { libraryEntityId: expansionWireKey(dropped.entity.id, 'm17'), excluded: true },
      ],
    });
    expect([...image.m17Settings!.channelTags.keys()]).toEqual([1]);
    expect(image.bytes[channelSlotAddress(2).record + 0x18]).toBe(0);
  });

  it('keeps M17 when expandModes is false and M17 is primary', () => {
    const row = channel(
      'Hub',
      [
        { mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
        m17Profile(),
      ],
      'm17',
    );
    const image = serialiseRadioFoundryCodeplug(assembled({ channels: [row] }), {
      expandModes: false,
    });
    expect(fieldText(image.bytes, channelSlotAddress(1).record, 16)).toBe('Hub');
    expect(image.m17Settings?.channelTags.size).toBe(1);
    expect(image.bytes[channelSlotAddress(2).record]).toBe(0xff);
  });
});

describe('RadioFoundry M17 import', () => {
  function shell(names: { name: string; dmr: boolean; rxOnly: boolean }[]): Uint8Array {
    const channels = names.map((row) => {
      const built = channel(
        row.name,
        row.dmr
          ? [dmrProfile()]
          : [{ mode: 'fm', squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 }],
      );
      built.entity.forbidTransmit = row.rxOnly ? 'forbid' : 'allow';
      return built;
    });
    return serialiseRadioFoundryCodeplug(assembled({ channels })).bytes.slice();
  }

  function putSector(image: Uint8Array, entries: { key: number; value: Uint8Array }[]): void {
    const encoded = encodeRadioFoundrySettingsSector(entries);
    if (!encoded.ok) throw new Error('fixture sector overflow');
    image.set(encoded.sector, SETTINGS_AREA_ADDRESS);
  }

  it('replaces a live kind-6 stand-in and reads the default callsign', () => {
    const image = shell([{ name: 'Echo', dmr: true, rxOnly: true }]);
    const record = image.subarray(
      channelSlotAddress(1).record,
      channelSlotAddress(1).record + CHANNEL_RECORD_SIZE,
    );
    const tag = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: record.subarray(0, 16),
      txAllowed: true,
      block: encodeM17ChannelBlock(3, false, 'ECHO')!,
    });
    putSector(image, [
      { key: 0x0400, value: tag },
      { key: 0x0a06, value: encodeM17CallsignRecord('AB1CD')! },
    ]);
    const parsed = parseRadioFoundryCodeplug(image, 'p');
    expect(parsed.channels[0]).toMatchObject({
      primaryMode: 'm17',
      forbidTransmit: 'allow',
      modeProfiles: [{ mode: 'm17', can: 3, playEveryCan: true, destination: 'ECHO' }],
    });
    expect(parsed.ownDigitalIds.find((row) => row.protocol === 'm17')).toMatchObject({
      callsign: 'AB1CD',
      isDefault: true,
    });
    expect(parsed.warnings.join('\n')).not.toContain('does not support');
  });

  it('keeps a real base profile when the tag says the base stands alone', () => {
    const image = shell([{ name: 'Local', dmr: false, rxOnly: false }]);
    const record = image.subarray(
      channelSlotAddress(1).record,
      channelSlotAddress(1).record + CHANNEL_RECORD_SIZE,
    );
    const tag = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: record.subarray(0, 16),
      txAllowed: false,
      baseStandsAlone: true,
      block: encodeM17ChannelBlock(0, true, '')!,
    });
    putSector(image, [{ key: 0x0400, value: tag }]);
    const parsed = parseRadioFoundryCodeplug(image, 'p');
    expect(parsed.channels[0]?.primaryMode).toBe('fm');
    expect(parsed.channels[0]?.modeProfiles.map((profile) => profile.mode)).toEqual(['fm', 'm17']);
    expect(parsed.channels[0]?.forbidTransmit).toBe('forbid');
    expect(parsed.ownDigitalIds.some((row) => row.protocol === 'm17')).toBe(false);
    expect(parsed.warnings).toEqual([]);
  });

  it('counts a stale M17 tag and still warns for another live kind', () => {
    const image = shell([
      { name: 'Echo', dmr: true, rxOnly: true },
      { name: 'Trunk', dmr: true, rxOnly: true },
    ]);
    const echo = image.subarray(
      channelSlotAddress(1).record,
      channelSlotAddress(1).record + CHANNEL_RECORD_SIZE,
    );
    const trunk = image.subarray(
      channelSlotAddress(2).record,
      channelSlotAddress(2).record + CHANNEL_RECORD_SIZE,
    );
    const live = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: echo.subarray(0, 16),
      txAllowed: false,
      block: encodeM17ChannelBlock(1, true, 'ALL')!,
    });
    const p25 = writeRadioFoundryChannelTag({
      kind: 2,
      system: null,
      storedName: trunk.subarray(0, 16),
      txAllowed: true,
      block: new Uint8Array(),
    });
    const stale = writeRadioFoundryChannelTag({
      kind: RADIOFOUNDRY_KIND_M17,
      system: null,
      storedName: new Uint8Array(16).fill(0xff),
      txAllowed: true,
      block: encodeM17ChannelBlock(0, true, '')!,
    });
    putSector(image, [
      { key: 0x0400, value: live },
      { key: 0x0401, value: p25 },
      { key: 0x0402, value: stale },
    ]);
    const parsed = parseRadioFoundryCodeplug(image, 'p');
    expect(parsed.channels[0]?.primaryMode).toBe('m17');
    expect(parsed.channels[1]?.primaryMode).toBe('dmr');
    const text = parsed.warnings.join('\n');
    expect(text).toContain('P25 conventional');
    expect(text).toContain('no longer matches');
    expect(text).not.toContain('M17 conventional');
  });

  it('says nothing about an erased area and does not import an invalid callsign', () => {
    const image = shell([{ name: 'Echo', dmr: true, rxOnly: true }]);
    expect(parseRadioFoundryCodeplug(image, 'p').ownDigitalIds.map((row) => row.protocol)).toEqual([
      'dmr',
    ]);
    putSector(image, [{ key: 0x0a06, value: Uint8Array.of(0x2a) }]);
    const parsed = parseRadioFoundryCodeplug(image, 'p');
    expect(parsed.ownDigitalIds.some((row) => row.protocol === 'm17')).toBe(false);
    expect(parsed.warnings).toEqual([]);
  });
});
