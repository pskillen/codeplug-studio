import { describe, expect, it } from 'vitest';
import { newChannel, newOwnDigitalId } from '@core/domain/factories.ts';
import type { Channel, ChannelModeProfileM17 } from '@core/models/library.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  materialiseRadioFoundryFileExport,
  serialiseRadioFoundryCodeplug,
} from '@core/import-export/formats/radiofoundry/serialise.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { FLASH_IMAGE_START } from './constants.ts';
import { RADIOFOUNDRY_REGION } from './debugCapture.ts';
import {
  archiveFromRadioFoundryImage,
  radioFoundryMemoryAssembled,
  radioFoundryMemoryFixtureArchive,
} from './__fixtures__/debugMemoryArchive.ts';
import { projectRadioFoundryMemory, reassembleRadioFoundryImage } from './debugMemory.ts';

describe('reassembleRadioFoundryImage', () => {
  it('fills the unserved gap with 0xFF between EEPROM and flash', () => {
    const archive = radioFoundryMemoryFixtureArchive();
    const image = reassembleRadioFoundryImage(archive)!;
    expect(image.length).toBe(RADIOFOUNDRY_IMAGE_SIZE);
    expect(image[0x10000]).toBe(0xff);
    expect(image[0x1ffff]).toBe(0xff);
    expect(image.some((b, i) => i >= FLASH_IMAGE_START && b !== 0xff)).toBe(true);
  });

  it('returns undefined when flash-image is missing', () => {
    const archive = radioFoundryMemoryFixtureArchive();
    const regions = { ...archive.regions };
    delete regions[RADIOFOUNDRY_REGION.flash];
    expect(reassembleRadioFoundryImage({ ...archive, regions })).toBeUndefined();
  });
});

describe('projectRadioFoundryMemory', () => {
  it('round-trips counts and names from a synthetic image', () => {
    const built = radioFoundryMemoryAssembled();
    const view = projectRadioFoundryMemory(radioFoundryMemoryFixtureArchive());
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.result.channels.map((ch) => ch.name).sort()).toEqual(
      built.channels.map((ch) => ch.wireName).sort(),
    );
    expect(view.result.zones).toHaveLength(1);
    expect(view.result.zones[0]!.name).toBe('Home');
    expect(view.result.talkGroups).toHaveLength(1);
    expect(view.result.digitalContacts).toHaveLength(1);
    expect(view.result.rxGroupLists).toHaveLength(1);
    expect(view.result.ownDigitalIds).toHaveLength(1);
  });

  it('shows a parsed M17 channel and callsign from the settings sector', () => {
    const profile: ChannelModeProfileM17 = {
      mode: 'm17',
      can: 3,
      playEveryCan: true,
      destination: 'ECHO',
    };
    const entity: Channel = {
      ...newChannel('p', 'Echo'),
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      primaryMode: 'm17',
      modeProfiles: [profile],
    };
    const channel: AssembledChannel = { entity, wireName: 'Echo' };
    const assembled: AssembledBuild = {
      buildId: 'b',
      formatId: 'radiofoundry',
      profileId: 'radiofoundry-dm32uv',
      buildName: 'DM-32',
      channels: [channel],
      zones: [],
      scanLists: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      ownDigitalIds: [
        { ...newOwnDigitalId('p', 'dmr', 'MM9PDY', 2_351_234), isDefault: true },
        { ...newOwnDigitalId('p', 'm17', 'AB1CD', 'AB1CD'), isDefault: true },
      ],
    };
    const file = materialiseRadioFoundryFileExport(serialiseRadioFoundryCodeplug(assembled));
    const view = projectRadioFoundryMemory(archiveFromRadioFoundryImage(file.bytes));
    expect(view.status).toBe('ok');
    if (view.status !== 'ok') return;
    expect(view.result.channels[0]).toMatchObject({
      primaryMode: 'm17',
      modeProfiles: [{ mode: 'm17', can: 3, playEveryCan: true, destination: 'ECHO' }],
    });
    expect(view.result.ownDigitalIds.find((row) => row.protocol === 'm17')).toMatchObject({
      callsign: 'AB1CD',
    });
  });

  it('reports not-captured when flash-image is missing', () => {
    const archive = radioFoundryMemoryFixtureArchive();
    const regions = { ...archive.regions };
    delete regions[RADIOFOUNDRY_REGION.flash];
    const view = projectRadioFoundryMemory({ ...archive, regions });
    expect(view).toEqual({
      status: 'not-captured',
      reason: 'The flash-image region was not captured.',
    });
  });

  it('returns not-decoded with the parser message for a short flash region', () => {
    const archive = radioFoundryMemoryFixtureArchive();
    archive.regions[RADIOFOUNDRY_REGION.flash] = archive.regions[
      RADIOFOUNDRY_REGION.flash
    ]!.subarray(0, 1024);
    const view = projectRadioFoundryMemory(archive);
    expect(view.status).toBe('not-decoded');
    if (view.status === 'not-decoded') {
      expect(view.reason).toMatch(/at least/);
    }
  });
});
