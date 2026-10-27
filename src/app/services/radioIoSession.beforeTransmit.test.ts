/**
 * The pre-transmit pause (#1393): `beforeTransmit` runs after the in-session read and before the
 * first frame; resolving it changes nothing on the wire; rejecting it sends nothing.
 */

import { describe, expect, it, vi } from 'vitest';
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
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import { encodeBcdFrequencyHz } from '@integrations/radio-io/radios/at-d890uv/bcd.ts';
import { setBitmapBit } from '@integrations/radio-io/radios/at-d890uv/bitmap.ts';
import {
  alignDownAtD890Address,
  channelPrimaryAddress,
  channelSecondaryAddress,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import type { CloneImageRadio, MemoryMap, RadioSession } from '@integrations/radio-io/types.ts';
import { reviewNeedsReconnect } from '@integrations/radio-io/programHold.ts';
import {
  closeRadioSession,
  uploadPreparedRadioWrite,
  type BeforeTransmitContext,
} from './radioIoSession.ts';

const SERIAL = 'SN-TEST-UPLOAD01';

async function d890Session(
  lockByte?: number,
): Promise<{ session: RadioSession; pipe: AtD890ScriptedPipe }> {
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
  const localInfo = localInfoWithSerial(SERIAL);
  if (lockByte !== undefined) localInfo[0x04] = lockByte;
  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfo],
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

describe('uploadPreparedRadioWrite beforeTransmit', () => {
  it('leaves the frames byte-identical when the hook resolves (D890 scripted pipe)', async () => {
    const plain = await d890Session();
    const plainWrites = plain.pipe.writes.length;
    await uploadPreparedRadioWrite(plain.session, egress, undefined, projected);
    const plainFrames = plain.pipe.writes.slice(plainWrites).map((f) => [...f]);

    const hooked = await d890Session();
    const hookedWrites = hooked.pipe.writes.length;
    let ctx: BeforeTransmitContext | undefined;
    let framesBeforeHook = -1;
    await uploadPreparedRadioWrite(hooked.session, egress, undefined, {
      ...projected,
      beforeTransmit: async (c) => {
        ctx = c;
        framesBeforeHook = hooked.pipe.writes.length - hookedWrites;
      },
    });
    const hookedFrames = hooked.pipe.writes.slice(hookedWrites).map((f) => [...f]);

    expect(plainFrames.length).toBeGreaterThan(0);
    expect(hookedFrames).toEqual(plainFrames);
    // The hook ran after the in-session read: no read was needed (cache seeded) and no W frame yet.
    expect(framesBeforeHook).toBe(0);
    expect(ctx?.identity).toMatchObject({ model: AT_D890UV_DESCRIPTOR.label, serial: SERIAL });
    expect(ctx?.channelCount).toBe(projection.channels.length);
    expect(ctx?.plan?.map((s) => s.label)).toContain('Upload');
  }, 20_000);

  it('leaves the frames byte-identical for a codeplug + contacts write (D890 single bank)', async () => {
    const contacts = [
      {
        wireName: 'Contact 1',
        digitalId: 1234567,
        callsign: 'CALL',
        city: 'City',
        province: 'State',
        country: 'Country',
        remark: 'Note',
      },
    ];
    const withContacts = {
      ...projected,
      organisation: { ...projected.organisation, digitalContacts: contacts },
    };
    async function run(hook: boolean, contactsOn = true) {
      const { session, pipe } = await d890Session();
      // The contact bank's erase units are read back and merged; serve them as erased flash.
      const base = pipe.readResponder;
      pipe.readResponder = (addr, len) => {
        try {
          const served = base?.(addr, len);
          if (served) return served;
        } catch {
          // Not a unit the codeplug script knows: erased flash.
        }
        return new Uint8Array(len).fill(0xff);
      };
      const before = pipe.writes.length;
      let atHook = -1;
      await uploadPreparedRadioWrite(session, egress, undefined, {
        ...(contactsOn ? withContacts : projected),
        parts: { codeplug: true, contacts: contactsOn, settings: false, keps: false },
        ...(hook
          ? {
              beforeTransmit: async () => {
                atHook = pipe.writes.length - before;
              },
            }
          : {}),
      });
      const frames = pipe.writes.slice(before).map((f) => [...f]);
      // END commits the session; without it the in-progress marker would block the next run.
      await closeRadioSession(session);
      return { frames, atHook };
    }
    const plain = await run(false);
    const codeplugOnly = await run(false, false);
    const hooked = await run(true);
    expect(plain.frames.length).toBeGreaterThan(0);
    // Contact frames are on the wire in both runs (a write to the contact bank follows the upload).
    expect(plain.frames.length).toBeGreaterThan(codeplugOnly.frames.length);
    expect(hooked.frames).toEqual(plain.frames);
    expect(hooked.atHook).toBe(0);
  }, 20_000);

  it('sends no frame when the hook rejects', async () => {
    const { session, pipe } = await d890Session();
    const before = pipe.writes.length;
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        ...projected,
        beforeTransmit: async () => {
          throw new Error('cancelled');
        },
      }),
    ).rejects.toThrow('cancelled');
    expect(pipe.writes.length).toBe(before);
  }, 20_000);

  it('refuses a language the radio region forbids before any frame (D890 language lock)', async () => {
    const { session, pipe } = await d890Session(1);
    const before = pipe.writes.length;
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        ...projected,
        settingsOverrides: [{ fieldId: 'language', value: 2 }],
        beforeTransmit: async () => 'apply',
      }),
    ).rejects.toThrow(/only allows English.*Language/);
    expect(pipe.writes.length).toBe(before);
  }, 20_000);

  it('fails closed when a language change cannot be checked because LocalInfo is not cached', async () => {
    const { session, pipe } = await d890Session();
    (session.radio as AtD890uvProtocol)
      .getDownloadCache()
      ?.blocks.delete(alignDownAtD890Address(D890_MAP.LocalInfo));
    const before = pipe.writes.length;
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        ...projected,
        settingsOverrides: [{ fieldId: 'language', value: 0 }],
        beforeTransmit: async () => 'apply',
      }),
    ).rejects.toThrow(/can't check this radio's language lock/);
    expect(pipe.writes.length).toBe(before);
  }, 20_000);

  it('lets an allowed language through to the upload', async () => {
    const { session, pipe } = await d890Session(1);
    const before = pipe.writes.length;
    await uploadPreparedRadioWrite(session, egress, undefined, {
      ...projected,
      settingsOverrides: [{ fieldId: 'language', value: 0 }],
      beforeTransmit: async () => 'apply',
    });
    expect(pipe.writes.length).toBeGreaterThan(before);
  }, 20_000);

  it('calls the hook before upload for a radio without a plan (generic path)', async () => {
    const order: string[] = [];
    const radio = {
      upload: vi.fn(async () => {
        order.push('upload');
      }),
    } as unknown as CloneImageRadio;
    const session: RadioSession = {
      descriptor: {
        label: 'Other',
        modelIds: ['OTHER'],
        hydration: { seedProtocolForUpload: undefined },
      } as unknown as RadioSession['descriptor'],
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const image = new Map() as unknown as MemoryMap;
    const { egress: otherEgress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    await uploadPreparedRadioWrite(session, otherEgress, image, {
      channels: [],
      beforeTransmit: async (ctx) => {
        order.push('hook');
        expect(ctx.identity).toEqual({ model: 'Other' });
        expect(ctx.plan).toBeUndefined();
      },
    });
    expect(order).toEqual(['hook', 'upload']);
  });
});

describe('reviewNeedsReconnect', () => {
  it('trusts a radio with no declared hold time for 30 s', () => {
    expect(reviewNeedsReconnect({}, 29_000)).toBe(false);
    expect(reviewNeedsReconnect({}, 31_000)).toBe(true);
  });
  it('never reconnects the D890', () => {
    expect(reviewNeedsReconnect(AT_D890UV_DESCRIPTOR, 3_600_000)).toBe(false);
  });
  it('honours a declared hold time', () => {
    expect(reviewNeedsReconnect({ programHoldSafeMs: 120_000 }, 100_000)).toBe(false);
    expect(reviewNeedsReconnect({ programHoldSafeMs: 120_000 }, 130_000)).toBe(true);
  });
});
