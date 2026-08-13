import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { OPENGD77_DM1701_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/dm1701/descriptor.ts';
import { OPENGD77_MD9600_DESCRIPTOR } from '@integrations/radio-io/radios/opengd77/md9600/descriptor.ts';
import { OPENUV380_OFFSET } from '@integrations/radio-io/radios/opengd77/constants.ts';
import { OpenGd77Protocol } from '@integrations/radio-io/radios/opengd77/protocol.ts';
import { OpenGd77ScriptedPipe } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { writeBuildToRadio } from './radioIoSession.ts';

function emptyLibrary(channels: LibrarySlice['channels'] = []): LibrarySlice {
  return {
    channels,
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

describe('OpenGD77 write without persisted hydration', () => {
  it('sets hydrationRequiredForWrite false on both family descriptors', () => {
    expect(OPENGD77_DM1701_DESCRIPTOR.hydrationRequiredForWrite).toBe(false);
    expect(OPENGD77_MD9600_DESCRIPTOR.hydrationRequiredForWrite).toBe(false);
    expect(OPENGD77_DM1701_DESCRIPTOR.hydration.seedProtocolForUpload).toBeUndefined();
    expect(OPENGD77_MD9600_DESCRIPTOR.hydration.seedProtocolForUpload).toBeUndefined();
  });

  it('writes without an egress hydration bag onto the in-session FLASH prior', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const settingsMarker = 0x71;
    pipe.plantByte(OPENUV380_OFFSET.settings, settingsMarker);
    const radio = new OpenGd77Protocol();
    await radio.connect(pipe);
    const session: RadioSession = {
      descriptor: OPENGD77_DM1701_DESCRIPTOR,
      pipe,
      radio,
    };
    const ch = {
      ...newChannel('p1', 'TEST'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    expect(egress.hydration).toBeUndefined();
    await writeBuildToRadio(
      session,
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      egress,
      emptyLibrary([ch]),
    );
    expect(pipe.flashByte(OPENUV380_OFFSET.settings)).toBe(settingsMarker);
    const written = radio.decodeChannels(radio.getPriorImage()!);
    expect(written.some((row) => row.wireName === 'TEST')).toBe(true);
  });
});
