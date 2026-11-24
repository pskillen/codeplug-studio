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
import { RadioTimeoutError } from '@integrations/radio-io/kit/errors.ts';
import type { ChannelModeProfile } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  ATD890_NXDN_NOT_WRITTEN_NOTICE,
  ATD890_RESET_PROTOCOL_OFF_NOTICE,
  closeRadioSession,
  prepareRadioWriteImage,
  RadioWriteBlockedError,
  uploadPreparedRadioWrite,
  type BeforeTransmitContext,
} from './radioIoSession.ts';
import { allowLeakedD890MarkersInThisFile } from '../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

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

  it('language lock refusal is none and nothing sent', async () => {
    const { session, pipe } = await d890Session(1);
    const before = pipe.writes.length;
    const err = await uploadPreparedRadioWrite(session, egress, undefined, {
      ...projected,
      settingsOverrides: [{ fieldId: 'language', value: 2 }],
      beforeTransmit: async () => 'apply',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioWriteBlockedError);
    expect((err as RadioWriteBlockedError).retry).toBe('none');
    expect((err as RadioWriteBlockedError).sent).toBe('nothing-sent');
    expect((err as RadioWriteBlockedError).message).toMatch(/only allows English.*Language/);
    expect(pipe.writes.length).toBe(before);
  }, 20_000);

  it('uncached LocalInfo language refusal is none and nothing sent', async () => {
    const { session, pipe } = await d890Session();
    (session.radio as AtD890uvProtocol)
      .getDownloadCache()
      ?.blocks.delete(alignDownAtD890Address(D890_MAP.LocalInfo));
    const before = pipe.writes.length;
    const err = await uploadPreparedRadioWrite(session, egress, undefined, {
      ...projected,
      settingsOverrides: [{ fieldId: 'language', value: 0 }],
      beforeTransmit: async () => 'apply',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioWriteBlockedError);
    expect((err as RadioWriteBlockedError).retry).toBe('none');
    expect((err as RadioWriteBlockedError).sent).toBe('nothing-sent');
    expect((err as RadioWriteBlockedError).message).toMatch(
      /can't check this radio's language lock/,
    );
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

  it('an upload failure is marked may hold part', async () => {
    const radio = {
      upload: vi.fn(async () => {
        throw new RadioTimeoutError();
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
    const err = await uploadPreparedRadioWrite(session, otherEgress, image, {
      channels: [],
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RadioTimeoutError);
    expect((err as RadioTimeoutError).sent).toBe('may-hold-part');
  });

  it('an upload failure that already says nothing sent keeps it', async () => {
    const timeout = new RadioTimeoutError();
    timeout.sent = 'nothing-sent';
    const radio = {
      upload: vi.fn(async () => {
        throw timeout;
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
    const err = await uploadPreparedRadioWrite(session, otherEgress, image, {
      channels: [],
    }).catch((e: unknown) => e);
    expect(err).toBe(timeout);
    expect((err as RadioTimeoutError).sent).toBe('nothing-sent');
  });
});

const NXDN: ChannelModeProfile = {
  mode: 'nxdn',
  rxRan: 7,
  txRan: 5,
  ownDigitalIdId: null,
  contactRef: null,
  rxGroupListId: null,
  nxdnRate: 'nxdn96',
};
const DMR: ChannelModeProfile = {
  mode: 'dmr',
  dmrMode: null,
  colourCode: 3,
  timeslot: 2,
  ownDigitalIdId: null,
  contactRef: null,
  rxGroupListId: null,
  sendTalkerAlias: 'default',
};

function nxdnChannel(id: string, rxHz: number, profiles: ChannelModeProfile[]) {
  return {
    ...newChannel('p1', id),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    power: 100,
    modeProfiles: profiles,
  };
}

function nxdnLibrary(): LibrarySlice {
  const channels = [
    nxdnChannel('both', 430_125_000, [DMR, NXDN]),
    nxdnChannel('only', 430_250_000, [NXDN]),
  ];
  return {
    channels,
    zones: [
      {
        ...newZone('p1', 'Z'),
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
}

function atD890SettingsStoreRecord(enabled: number): Uint8Array {
  const r = new Uint8Array(32).fill(0);
  r[0] = 0x4d;
  r[1] = 0x36;
  r[2] = 1;
  r[21] = enabled;
  let sum = 0;
  for (let i = 0; i < 31; i++) sum += r[i]!;
  r[31] = sum & 0xff;
  return r;
}

async function d890SessionForNxdnGate(
  store: Uint8Array | null,
  resetProtocol = 0,
): Promise<{ session: RadioSession; pipe: AtD890ScriptedPipe }> {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  const unit350 = makeAtD890EraseUnitBuffer();
  unit350.fill(0, 0, 0x1400);
  unit350[0x154] = resetProtocol;
  scriptAtD890UploadReadResponder(
    pipe,
    new Map([
      [0x350_0000, unit350],
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
  const resetBlock = new Uint8Array(16);
  resetBlock[0x154 % 16] = resetProtocol;
  blocks.set(0x350_0150, resetBlock);
  radio.seedDownloadCache({ blocks });
  enableAtD890AutoWriteAck(pipe);
  return { session: { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio }, pipe };
}

describe('uploadPreparedRadioWrite beforeTransmit — AT-D890 NXDN gate', () => {
  it('NXDN not written reaches the pause as a radio warning', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv-mm9pdy');
    const library = nxdnLibrary();
    const prepared = await prepareRadioWriteImage(build, egress, library);
    expect(prepared.nxdn).toBeDefined();

    let nxdnCtx: BeforeTransmitContext | undefined;
    const disabled = await d890SessionForNxdnGate(atD890SettingsStoreRecord(0));
    await uploadPreparedRadioWrite(disabled.session, egress, prepared.image, {
      organisation: prepared.organisation,
      channels: prepared.channels,
      ...(prepared.nxdn ? { nxdn: prepared.nxdn, warnings: prepared.warnings } : {}),
      beforeTransmit: async (ctx) => {
        nxdnCtx = ctx;
      },
    });
    await closeRadioSession(disabled.session);
    const nxdnNotice = nxdnCtx!.radioWarnings?.find(
      (w) => w.kind === 'general' && w.message === ATD890_NXDN_NOT_WRITTEN_NOTICE,
    );
    expect(nxdnNotice?.severity).toBe('problem');

    let resetCtx: BeforeTransmitContext | undefined;
    const enabled = await d890SessionForNxdnGate(atD890SettingsStoreRecord(1), 2);
    await uploadPreparedRadioWrite(enabled.session, egress, prepared.image, {
      organisation: prepared.organisation,
      channels: prepared.channels,
      ...(prepared.nxdn ? { nxdn: prepared.nxdn, warnings: prepared.warnings } : {}),
      beforeTransmit: async (ctx) => {
        resetCtx = ctx;
      },
    });
    await closeRadioSession(enabled.session);
    const resetNotice = resetCtx!.radioWarnings?.find(
      (w) => w.kind === 'general' && w.message === ATD890_RESET_PROTOCOL_OFF_NOTICE,
    );
    expect(resetNotice?.severity).toBe('info');
  }, 40_000);
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
