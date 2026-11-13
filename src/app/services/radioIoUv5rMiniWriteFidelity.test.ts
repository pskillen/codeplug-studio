/**
 * UV-5R Mini Write fidelity through the library (#1578): a library that describes the radio as read, written
 * through the app's Write path, leaves the clone image byte for byte as read. Synthetic image, fake radio.
 */

import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { UV5R_MINI_LAYOUT as layout } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { decodeChannelsFromImage } from '@integrations/radio-io/radios/uv17pro-family/channelCodec.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import { Uv5rMiniProtocol } from '@integrations/radio-io/radios/uv5r-mini/protocol.ts';
import { FakeMiniRadio } from '@integrations/radio-io/radios/uv5r-mini/__fixtures__/fakeMiniRadio.ts';
import { createRealisticPriorImage } from '@integrations/radio-io/radios/uv5r-mini/__fixtures__/realisticPriorImage.ts';
import { prepareRadioWriteImage, uploadPreparedRadioWrite } from './radioIoSession.ts';

const REGIONS = layout.memStarts.map((start, i) => ({
  start,
  size: layout.memSizes[i]!,
  packed: layout.memStarts.slice(0, i).reduce((sum, _, j) => sum + layout.memSizes[j]!, 0),
}));

/** Every clone block address (`0x0000-0x803F`, `0x9000-0x903F`, `0xA000-0xA1BF`). */
const CLONE_BLOCKS = REGIONS.flatMap((r) =>
  Array.from({ length: r.size / layout.blockSize }, (_, i) => r.start + i * layout.blockSize),
);

function toneString(tone: RadioTone): string {
  if (tone.kind === 'ctcss') return String(tone.hz);
  if (tone.kind === 'dcs') return `D${String(tone.code).padStart(3, '0')}${tone.polarity ?? 'N'}`;
  return 'none';
}

/** The library entry a user would hold for a channel as read. */
function libraryChannel(dto: RadioChannelDto): Channel {
  return {
    ...newChannel('p1', dto.wireName),
    id: `ch-${dto.slotIndex}`,
    rxFrequency: dto.rxHz,
    txFrequency: dto.txHz,
    power: dto.powerPercent,
    scanInclusion: dto.scanAdd ? 'alwaysScan' : 'skip',
    forbidTransmit: dto.rxOnly ? 'forbid' : 'allow',
    modeProfiles: [
      {
        mode: 'fm' as const,
        squelch: null,
        rxTone: toneString(dto.rxTone),
        txTone: toneString(dto.txTone),
        bandwidthKHz: dto.bandwidth === 'NFM' ? 12.5 : 25,
      },
    ],
  };
}

describe('UV-5R Mini Write through the library (#1578)', () => {
  it('an unchanged library leaves the clone image as read', async () => {
    const prior = createRealisticPriorImage();
    // A library channel always has a wire name (an empty one becomes a placeholder), so the nameless slot in
    // the fixture gets a name here. The radio-boundary round trip covers the nameless slot.
    const nameless = (100 - 1) * layout.channelSize + 20;
    prior.set(new TextEncoder().encode('NAMED 100'), nameless);
    const radio = new FakeMiniRadio();
    for (const r of REGIONS) radio.flash.set(prior.subarray(r.packed, r.packed + r.size), r.start);

    const live = decodeChannelsFromImage(layout, prior).filter((c) => !c.empty);
    const channels = live.map(libraryChannel);
    const library: LibrarySlice = {
      channels,
      zones: [],
      scanLists: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      aprsConfiguration: null,
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const prepared = await prepareRadioWriteImage(
      {
        ...build,
        channelOverrides: live.map((c) => ({
          libraryEntityId: `ch-${c.slotIndex}`,
          wireName: c.wireName,
          orderOrSlot: c.slotIndex,
        })),
      },
      { ...egress, hydration: undefined },
      library,
    );
    expect(prepared.channels.map((c) => c.slotIndex)).toEqual(live.map((c) => c.slotIndex));

    const proto = new Uv5rMiniProtocol();
    await proto.connect(radio, { handshake: 'none' });
    const session: RadioSession = { descriptor: UV5R_MINI_DESCRIPTOR, pipe: radio, radio: proto };
    await uploadPreparedRadioWrite(session, egress, prepared.image, {
      channels: prepared.channels,
      organisation: prepared.organisation,
    });

    const after = new Uint8Array(layout.memTotal);
    for (const r of REGIONS) after.set(radio.flash.subarray(r.start, r.start + r.size), r.packed);
    expect(after).toEqual(prior);
    // The fake's flash held the prior before the Write, so the equality above only counts if every clone block
    // was sent.
    const sent = radio.wAddresses();
    expect(sent.length).toBeGreaterThan(0);
    expect(new Set(sent)).toEqual(new Set(CLONE_BLOCKS));
    expect(sent.every((a) => a < 0xf000)).toBe(true);
  });
});
