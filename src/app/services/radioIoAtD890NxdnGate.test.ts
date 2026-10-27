/**
 * AT-D890 MM9PDY NXDN gate at Write time: the radio's own settings-store record decides, after the
 * in-session read, whether the NXDN projection or the standard one is sent.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import {
  AtD890ScriptedPipe,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import { encodeBcdFrequencyHz } from '@integrations/radio-io/radios/at-d890uv/bcd.ts';
import { setBitmapBit } from '@integrations/radio-io/radios/at-d890uv/bitmap.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { clearAllAtD890PendingRecords } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import {
  ATD890_NXDN_NOT_WRITTEN_NOTICE,
  closeRadioSession,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
  type BeforeTransmitContext,
} from './radioIoSession.ts';

const SERIAL = 'SN-TEST-UPLOAD01';
const P = 'p1';

const DMR: ChannelModeProfile = {
  mode: 'dmr',
  dmrMode: null,
  colourCode: 3,
  timeslot: 2,
  dmrId: null,
  contactRef: null,
  rxGroupListId: null,
  sendTalkerAlias: 'default',
};
const NXDN: ChannelModeProfile = {
  mode: 'nxdn',
  rxRan: 7,
  txRan: 5,
  unitId: null,
  contactRef: null,
  rxGroupListId: null,
  nxdnRate: 'nxdn96',
};

function ch(id: string, rxHz: number, profiles: ChannelModeProfile[]): Channel {
  return {
    ...newChannel(P, id),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    power: 100,
    modeProfiles: profiles,
  };
}

const channels = [ch('both', 430_125_000, [DMR, NXDN]), ch('only', 430_250_000, [NXDN])];
const library: LibrarySlice = {
  channels,
  zones: [
    {
      ...newZone(P, 'Z'),
      id: 'z',
      members: channels.map((c) => ({ kind: 'channel' as const, channelId: c.id })),
    },
  ],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};
const { build, egress } = newRadioBuildForProfile(P, 'radio-io-at-d890uv-mm9pdy');

/** A 32-byte MM9PDY settings-store record. */
function storeRecord(unlock: number, goodSum = true): Uint8Array {
  const r = new Uint8Array(32).fill(0);
  r[0] = 0x4d;
  r[1] = 0x36;
  r[2] = 1;
  r[21] = unlock;
  let sum = 0;
  for (let i = 0; i < 31; i++) sum += r[i]!;
  r[31] = goodSum ? sum & 0xff : (sum + 1) & 0xff;
  return r;
}

async function d890Session(store: Uint8Array | null): Promise<RadioSession> {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  scriptAtD890UploadReadResponder(
    pipe,
    new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [0x100_0000, makeAtD890EraseUnitBuffer()],
      [0x348_0000, unit348],
    ]),
  );
  const channelSet = new Uint8Array(0x200);
  setBitmapBit(channelSet, 0, true);
  const primary = new Uint8Array(0x40);
  primary.set(encodeBcdFrequencyHz(145_520_000), 0);
  const blocks = new Map<number, Uint8Array>([
    [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
    [D890_MAP.ChannelSet, channelSet],
    [channelPrimaryAddress(0), primary],
    [channelSecondaryAddress(0), new Uint8Array(0x40)],
    [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
  ]);
  if (store) {
    blocks.set(D890_MAP.SettingsStore, store.slice(0, 16));
    blocks.set(D890_MAP.SettingsStore + 16, store.slice(16, 32));
  }
  radio.seedDownloadCache({ blocks });
  enableAtD890AutoWriteAck(pipe);
  return { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio };
}

beforeEach(() => clearAllAtD890PendingRecords());
afterEach(() => clearAllAtD890PendingRecords());

async function run(store: Uint8Array | null) {
  const prepared = await prepareRadioWriteImage(build, egress, library);
  const session = await d890Session(store);
  let seen: BeforeTransmitContext | undefined;
  const result = await uploadPreparedRadioWrite(session, egress, prepared.image, {
    organisation: prepared.organisation,
    channels: prepared.channels,
    ...(prepared.nxdn ? { nxdn: prepared.nxdn, warnings: prepared.warnings } : {}),
    beforeTransmit: async (ctx) => {
      seen = ctx;
    },
  });
  await closeRadioSession(session);
  return { prepared, result, seen: seen! };
}

const text = (ws: readonly Parameters<typeof formatExportWarning>[0][]) =>
  ws.map((w) => formatExportWarning(w)).join('\n');

describe('AT-D890 MM9PDY NXDN gate on Write', () => {
  it('prepare builds the NXDN variant only when the build has NXDN channels', async () => {
    const { prepared } = await run(storeRecord(1));
    expect(prepared.nxdn).toBeDefined();
    expect(prepared.channels.map((c) => c.nxdn)).toEqual([undefined]);
    expect(prepared.nxdn!.channels.map((c) => c.nxdn?.rxRan)).toEqual([7, 7]);

    const plain = await prepareRadioWriteImage(build, egress, {
      ...library,
      channels: [ch('p', 430_125_000, [DMR])],
    });
    expect(plain.nxdn).toBeUndefined();
  });

  it('radio with nxdn_unlock = 1 sends the NXDN projection', async () => {
    const { result, seen } = await run(storeRecord(1));
    expect(result.channels).toHaveLength(2);
    expect(seen.channels).toHaveLength(2);
    expect(text(result.projectionWarnings!)).not.toContain(ATD890_NXDN_NOT_WRITTEN_NOTICE);
  });

  for (const [label, store] of [
    ['nxdn_unlock = 0', storeRecord(0)],
    ['a bad sum', storeRecord(1, false)],
    ['no store record', null],
  ] as const) {
    it(`radio with ${label} sends the standard projection and one notice`, async () => {
      const { prepared, result, seen } = await run(store);
      expect(result.channels).toHaveLength(1);
      expect(result.channels![0]!.nxdn).toBeUndefined();
      expect(seen.channels).toHaveLength(1);
      expect(result.channels).toEqual(prepared.channels);
      const notices = result.projectionWarnings!.filter((w) =>
        formatExportWarning(w).includes(ATD890_NXDN_NOT_WRITTEN_NOTICE),
      );
      expect(notices).toHaveLength(1);
    });
  }
});
