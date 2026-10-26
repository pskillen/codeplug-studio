/**
 * AT-D890 contact Write through the session functions (#1406): a failed or cancelled contact
 * write leaves PROGRAM without `END`.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import {
  AT_D890_SAFE_SKIP_WRITE_ADDR,
  D890_MAP,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import {
  AtD890ScriptedPipe,
  assertAtD890NoReadAfterWrite,
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
import {
  AtD890PendingUnitsError,
  clearAtD890PendingUnits,
  readAtD890PendingUnits,
} from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { interruptedWriteWarning } from './radioIoInterruptedWrite.ts';
import { atD890WriteMemory } from '@integrations/radio-io/radios/at-d890uv/connection.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import {
  closeRadioSession,
  uploadPreparedRadioWrite,
  writeBuildToRadio,
} from './radioIoSession.ts';
import { uploadAtD890DigitalContactsForWrite } from './radioIoAtD890DigitalContactWrite.ts';

const SERIAL = 'SN-TEST-UPLOAD01';

async function d890Session(): Promise<{ session: RadioSession; pipe: AtD890ScriptedPipe }> {
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
  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [D890_MAP.ChannelSet, channelSet],
      [channelPrimaryAddress(0), primary],
      [channelSecondaryAddress(0), new Uint8Array(0x40)],
      [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
    ]),
  });
  enableAtD890AutoWriteAck(pipe);
  return { session: { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio }, pipe };
}

const { build: baseBuild, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
const build = {
  ...baseBuild,
  layout: {
    sections: [
      {
        kind: 'zoneGrouping' as const,
        zones: [{ id: 'zone-1', name: 'Zone', channelIds: ['ch-1'] }],
      },
    ],
  },
};
const channel = {
  ...newChannel('p1', 'CH1'),
  id: 'ch-1',
  rxFrequency: 145_500_000,
  txFrequency: 145_500_000,
  power: 100,
  modeProfiles: [
    { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
  ],
};
const library = {
  channels: [channel],
  zones: [
    {
      ...newZone('p1', 'Zone'),
      id: 'zone-1',
      members: [{ kind: 'channel' as const, channelId: 'ch-1' }],
    },
  ],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};
const projection = buildRadioWriteProjection(
  assemble(build, library, { formatId: egress.formatId, profileId: egress.profileId }),
  build,
  library,
  egress,
);
const projected = { channels: projection.channels, organisation: projection.organisation };

const contacts = [1, 2].map((i) => ({
  wireName: `Contact ${i}`,
  digitalId: 1_000_000 + i,
  callsign: `CALL${i}`,
  city: 'City',
  province: 'State',
  country: 'Country',
  remark: '',
}));
const withContacts = {
  ...projected,
  organisation: { ...projected.organisation, digitalContacts: contacts },
};

function contactFrameCount(pipe: AtD890ScriptedPipe): number {
  return pipe.writes.filter((f) => f[0] === 0x57 && f[1] === 0x07).length;
}

function sentEnd(pipe: AtD890ScriptedPipe): boolean {
  return pipe.writes.some((f) => f.length === 3 && f[0] === 0x45 && f[1] === 0x4e && f[2] === 0x44);
}

// The pending-units record lives in browser storage: keep every test independent of the others.
beforeEach(() => clearAtD890PendingUnits());
afterEach(() => clearAtD890PendingUnits());

describe('AT-D890 Write flows send no R after the first W (#1406)', () => {
  it('uploadPreparedRadioWrite: codeplug + contacts', async () => {
    const { session, pipe } = await d890Session();
    await uploadPreparedRadioWrite(session, egress, undefined, withContacts);
    expect(contactFrameCount(pipe)).toBeGreaterThan(1);
    await closeRadioSession(session);
    assertAtD890NoReadAfterWrite(pipe.writes);
  });

  it('writeBuildToRadio: codeplug (+ contacts when the build has them)', async () => {
    const { session, pipe } = await d890Session();
    await writeBuildToRadio(session, build, egress, library);
    expect(pipe.writes.some((f) => f[0] === 0x57)).toBe(true);
    await closeRadioSession(session);
    assertAtD890NoReadAfterWrite(pipe.writes);
  });

  it('contacts only', async () => {
    const { session, pipe } = await d890Session();
    const readsBefore = pipe.writes.filter((f) => f[0] === 0x52).length;
    await uploadAtD890DigitalContactsForWrite(session, contacts);
    expect(contactFrameCount(pipe)).toBeGreaterThan(1);
    // No preserve read: the contact Write sends no R at all.
    expect(pipe.writes.filter((f) => f[0] === 0x52)).toHaveLength(readsBefore);
    await closeRadioSession(session);
    assertAtD890NoReadAfterWrite(pipe.writes);
  });
});

describe('AT-D890 contact write failure handling', () => {
  it('a clean Write sends END on close', async () => {
    const { session, pipe } = await d890Session();
    await uploadPreparedRadioWrite(session, egress, undefined, withContacts);
    expect(contactFrameCount(pipe)).toBeGreaterThan(1);
    await closeRadioSession(session);
    expect(sentEnd(pipe)).toBe(true);
  });

  it('a contact W NAK abandons PROGRAM: no END after the session closes', async () => {
    const { session, pipe } = await d890Session();
    let contactFrames = 0;
    pipe.writeAckResponder = (address) => {
      if (address < 0x0700_0000) return 0x06;
      contactFrames += 1;
      return contactFrames === 2 ? 0x15 : 0x06;
    };
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, withContacts),
    ).rejects.toThrow(/not ACKed/);
    await closeRadioSession(session);
    expect(sentEnd(pipe)).toBe(false);
  });

  it('a cancel mid-contacts abandons PROGRAM: no END after the session closes', async () => {
    const { session, pipe } = await d890Session();
    const abort = new AbortController();
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        ...withContacts,
        onProgress: (p) => {
          if (p.stage === 'Digital contacts' && p.cur === 2) abort.abort();
        },
        signal: abort.signal,
      }),
    ).rejects.toThrow();
    expect(contactFrameCount(pipe)).toBeGreaterThan(0);
    await closeRadioSession(session);
    expect(sentEnd(pipe)).toBe(false);
  });
});

describe('AT-D890 interrupted Write leaves units pending (#1406)', () => {
  /** NAK the second contact frame: the codeplug units and the contact meta unit are finished. */
  async function interruptedWrite() {
    const { session, pipe } = await d890Session();
    let contactFrames = 0;
    pipe.writeAckResponder = (address) => {
      if (address < 0x0700_0000) return 0x06;
      contactFrames += 1;
      return contactFrames === 2 ? 0x15 : 0x06;
    };
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, withContacts),
    ).rejects.toThrow(/not ACKed/);
    await closeRadioSession(session);
    return pipe;
  }

  it('records the finished units but not the one in progress', async () => {
    await interruptedWrite();
    const pending = readAtD890PendingUnits();
    expect(pending).toContain(0x0700_0000); // contact meta unit: finished
    expect(pending).not.toContain(0x0708_0000); // contact order unit: the NAK hit its first frame
    expect(pending.length).toBeGreaterThan(1); // the codeplug units too
    // The failure carries the warning; a refusal does not repeat it; other radios get none.
    expect(interruptedWriteWarning(egress.profileId, new Error('x'))).toMatch(/full Write/);
    expect(
      interruptedWriteWarning(egress.profileId, new AtD890PendingUnitsError(pending)),
    ).toBeNull();
    expect(interruptedWriteWarning('radio-io-dm32uv', new Error('x'))).toBeNull();
  });

  it('a failure before the second unit records nothing', async () => {
    const { session, pipe } = await d890Session();
    pipe.writeAckResponder = () => 0x15;
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, withContacts),
    ).rejects.toThrow(/not ACKed/);
    await closeRadioSession(session);
    expect(readAtD890PendingUnits()).toEqual([]);
  });

  it('refuses a write that would not rewrite them, sending no W frame', async () => {
    await interruptedWrite();
    const { session, pipe } = await d890Session();
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, projected),
    ).rejects.toBeInstanceOf(AtD890PendingUnitsError);
    expect(pipe.writes.some((f) => f[0] === 0x57)).toBe(false);
    await closeRadioSession(session);
    expect(sentEnd(pipe)).toBe(false);
    expect(readAtD890PendingUnits().length).toBeGreaterThan(0);
  });

  it('refuses other Studio senders (keps, restore, settings) the same way', async () => {
    await interruptedWrite();
    const { pipe } = await d890Session();
    await expect(
      atD890WriteMemory(pipe, D890_MAP.ChannelSet, new Uint8Array(0x10)),
    ).rejects.toBeInstanceOf(AtD890PendingUnitsError);
    expect(pipe.writes.some((f) => f[0] === 0x57)).toBe(false);
  });

  it('a Write that rewrites them completes with END and clears the record', async () => {
    await interruptedWrite();
    const { session, pipe } = await d890Session();
    await uploadPreparedRadioWrite(session, egress, undefined, withContacts);
    expect(readAtD890PendingUnits().length).toBeGreaterThan(0); // not committed until END
    await closeRadioSession(session);
    expect(sentEnd(pipe)).toBe(true);
    expect(readAtD890PendingUnits()).toEqual([]);
  });
});
