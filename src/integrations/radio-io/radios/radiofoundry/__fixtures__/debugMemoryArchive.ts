import {
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
  newRxGroupList,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { serialiseRadioFoundryCodeplug } from '@core/import-export/formats/radiofoundry/serialise.ts';
import { RADIOFOUNDRY_IMAGE_SIZE } from '@core/import-export/formats/radiofoundry/layout.ts';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../../backup/types.ts';
import { EEPROM_IMAGE_END, FLASH_IMAGE_START } from '../constants.ts';
import { RADIOFOUNDRY_REGION } from '../debugCapture.ts';
import type { RadioFoundryMemoryArchive } from '../debugMemory.ts';

function fmChannel(name: string, callsign = ''): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name, callsign),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      {
        mode: 'fm',
        squelch: null,
        rxTone: 'none',
        txTone: 'none',
        bandwidthKHz: 12.5,
      },
    ],
  };
  return { entity, wireName: name };
}

function dmrChannel(name: string, callsign = ''): AssembledChannel {
  const entity: Channel = {
    ...newChannel('p', name, callsign),
    rxFrequency: 430_000_000,
    txFrequency: 430_000_000,
    primaryMode: 'dmr',
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
  return { entity, wireName: name };
}

/** Synthetic RadioFoundry capture with two channels, a zone, lists and a radio ID. */
export function radioFoundryMemoryAssembled(): AssembledBuild {
  const chCallsign = fmChannel('Repeater', 'MM0AAA');
  const chSimplex = dmrChannel('Calling');
  const talkGroup = {
    entity: newTalkGroup('p', 'Local', 9_001, 'dmr'),
    wireName: 'Local',
  };
  const contact = {
    entity: { ...newDigitalContact('p', 'Alice', 2_340_001, 'dmr'), callsign: 'MM0AAA' },
    wireName: 'Alice',
  };
  const rxGroup = {
    entity: {
      ...newRxGroupList('p', 'My group'),
      members: [{ ref: { kind: 'talkGroup' as const, id: talkGroup.entity.id } }],
    },
    wireName: 'My group',
  };
  const ownId = { ...newOwnDigitalId('p', 'dmr', 'MM0AAA', 2_340_001), isDefault: true };
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'Test',
    channels: [chCallsign, chSimplex],
    zones: [{ zoneId: 'z1', wireName: 'Home', memberChannelIds: [chCallsign.entity.id] }],
    scanLists: [],
    talkGroups: [talkGroup],
    digitalContacts: [contact],
    analogContacts: [],
    rxGroupLists: [rxGroup],
    ownDigitalIds: [ownId],
  };
}

export function archiveFromRadioFoundryImage(
  image: Uint8Array,
  modelId = 'DM-32UV-RadioFoundry',
): RadioFoundryMemoryArchive {
  const eeprom = image.subarray(0, EEPROM_IMAGE_END);
  const flash = image.subarray(FLASH_IMAGE_START, RADIOFOUNDRY_IMAGE_SIZE);
  const manifest: RadioBackupManifestV1 = {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-03-01T00:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: 'test' },
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: image.length,
    radioModelId: modelId,
    regions: [
      {
        id: RADIOFOUNDRY_REGION.eeprom,
        address: 0,
        byteLength: eeprom.length,
        label: 'EEPROM',
        path: `regions/${RADIOFOUNDRY_REGION.eeprom}.bin`,
        restoreRole: 'inspect-only',
      },
      {
        id: RADIOFOUNDRY_REGION.flash,
        address: FLASH_IMAGE_START,
        byteLength: flash.length,
        label: 'Flash',
        path: `regions/${RADIOFOUNDRY_REGION.flash}.bin`,
        restoreRole: 'inspect-only',
      },
    ],
  };
  return {
    manifest,
    regions: {
      [RADIOFOUNDRY_REGION.eeprom]: eeprom,
      [RADIOFOUNDRY_REGION.flash]: flash,
    },
  };
}

export function radioFoundryMemoryFixtureArchive(): RadioFoundryMemoryArchive {
  const { bytes } = serialiseRadioFoundryCodeplug(radioFoundryMemoryAssembled());
  return archiveFromRadioFoundryImage(bytes);
}

export { fmChannel, dmrChannel, serialiseRadioFoundryCodeplug };
