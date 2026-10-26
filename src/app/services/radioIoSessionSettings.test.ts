import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  type AtD890UploadBankIntent,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { localInfoWithSerial } from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import {
  RadioWriteBlockedError,
  RadioWriteCancelledError,
  uploadPreparedRadioWrite,
  type AtD890PreTransmitContext,
  type BeforeTransmitContext,
} from './radioIoSession.ts';

const SERIAL = 'SN-TEST-SESSION1';

const analogCh: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: 'CH1',
  rxHz: 145_500_000,
  txHz: 145_500_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: 100,
  bandwidth: 'FM',
  mode: 'analog',
};

const organisation = { zones: [{ wireName: 'Z1', channelNumbers: [1] }] };

function makeSession() {
  const radio = new AtD890uvProtocol();
  radio.seedDownloadCache({ blocks: new Map([[D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)]]) });
  const cache = radio.getDownloadCache()!;
  putCacheBytes(cache, D890_MAP.RadioIdSet, new Uint8Array(0x20));
  putCacheBytes(cache, D890_MAP.ChannelSet, new Uint8Array(0x200));
  putCacheBytes(cache, channelPrimaryAddress(0), new Uint8Array(0x40));
  putCacheBytes(cache, channelSecondaryAddress(0), new Uint8Array(0x40));
  putCacheBytes(cache, D890_MAP.ZoneSet, new Uint8Array(0x20));
  putCacheBytes(cache, D890_MAP.ZoneHide, new Uint8Array(0x20).fill(0xff));
  putCacheBytes(cache, D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff));
  const main = new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0x21);
  putCacheBytes(cache, D890_MAP.OptionalSettingsMain, main);
  const upload = vi.spyOn(radio, 'upload').mockResolvedValue(undefined);
  const intents: AtD890UploadBankIntent[] = [];
  const realSet = radio.setUploadBankIntent.bind(radio);
  vi.spyOn(radio, 'setUploadBankIntent').mockImplementation((intent) => {
    intents.push(intent);
    realSet(intent);
  });
  const session: RadioSession = {
    descriptor: AT_D890UV_DESCRIPTOR,
    pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
    radio,
  };
  const { egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
  return { session, egress, upload, intents };
}

const overrides = [{ fieldId: 'keyShortP1', value: 9 }];

describe('uploadPreparedRadioWrite with AT-D890UV settings overrides', () => {
  it('offers the pause without overrides, and an apply decision adds no patches', async () => {
    const { session, egress, upload, intents } = makeSession();
    const beforeTransmit = vi.fn<(ctx: BeforeTransmitContext) => Promise<'apply'>>(
      async () => 'apply',
    );
    await uploadPreparedRadioWrite(session, egress, undefined, {
      organisation,
      channels: [analogCh],
      beforeTransmit,
    });
    expect(beforeTransmit).toHaveBeenCalledTimes(1);
    expect(beforeTransmit.mock.calls[0]![0].atD890?.overrides).toEqual([]);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(intents).toHaveLength(1);
    expect(intents[0]!.settingsPatches).toBeUndefined();
  });

  it('calls beforeTransmit once with the serial and snapshot, then applies the patches', async () => {
    const { session, egress, upload, intents } = makeSession();
    const seen: AtD890PreTransmitContext[] = [];
    await uploadPreparedRadioWrite(session, egress, undefined, {
      organisation,
      channels: [analogCh],
      settingsOverrides: overrides,
      beforeTransmit: async (ctx) => {
        seen.push(ctx.atD890!);
        expect(upload).not.toHaveBeenCalled();
        return 'apply';
      },
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.serial).toBe(SERIAL);
    expect(seen[0]!.target).toBe('stock');
    expect(seen[0]!.overrides).toEqual(overrides);
    expect(seen[0]!.snapshot.main[0]).toBe(0x21);
    expect(upload).toHaveBeenCalledTimes(1);
    const last = intents[intents.length - 1]!;
    expect(last.settingsPatches?.map((p) => [p.fieldId, [...p.bytes]])).toEqual([
      ['keyShortP1', [9]],
    ]);
  });

  describe("the object form { decision: 'apply', overrides }", () => {
    const stepKeys = [
      { fieldId: 'keyShortP1', value: 14 },
      { fieldId: 'keyShortP2', value: 13 },
    ];

    it('applies overrides that were not set at the start, as the string form would have', async () => {
      const viaStart = makeSession();
      await uploadPreparedRadioWrite(viaStart.session, viaStart.egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: stepKeys,
        beforeTransmit: async () => 'apply',
      });
      const viaPause = makeSession();
      await uploadPreparedRadioWrite(viaPause.session, viaPause.egress, undefined, {
        organisation,
        channels: [analogCh],
        beforeTransmit: async (ctx) => {
          expect(ctx.atD890?.overrides).toEqual([]);
          return { decision: 'apply', overrides: stepKeys };
        },
      });
      const last = viaPause.intents[viaPause.intents.length - 1]!;
      expect(last.settingsPatches?.map((p) => [p.fieldId, [...p.bytes]])).toEqual([
        ['keyShortP1', [14]],
        ['keyShortP2', [13]],
      ]);
      expect(last).toEqual(viaStart.intents[viaStart.intents.length - 1]);
      expect(viaPause.upload).toHaveBeenCalledTimes(1);
    });

    it('replaces the overrides given at the start with the ones the pause returns', async () => {
      const { session, egress, intents } = makeSession();
      await uploadPreparedRadioWrite(session, egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: overrides,
        beforeTransmit: async () => ({ decision: 'apply', overrides: stepKeys }),
      });
      const ids = intents[intents.length - 1]!.settingsPatches?.map((p) => p.fieldId);
      expect(ids).toEqual(['keyShortP1', 'keyShortP2']);
    });

    it('an empty list replaces the start overrides: the codeplug is written with no settings patches', async () => {
      const { session, egress, upload, intents } = makeSession();
      await uploadPreparedRadioWrite(session, egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: overrides,
        beforeTransmit: async () => ({ decision: 'apply', overrides: [] }),
      });
      expect(upload).toHaveBeenCalledTimes(1);
      expect(intents[intents.length - 1]!.settingsPatches).toBeUndefined();
    });

    it('refuses a bad, duplicated or unknown override from the pause before any frame', async () => {
      for (const bad of [
        [{ fieldId: 'keyShortP1', value: 99 }],
        [
          { fieldId: 'keyShortP1', value: 14 },
          { fieldId: 'keyShortP1', value: 13 },
        ],
        [{ fieldId: 'noSuchField', value: 1 }],
      ]) {
        const { session, egress, upload } = makeSession();
        await expect(
          uploadPreparedRadioWrite(session, egress, undefined, {
            organisation,
            channels: [analogCh],
            beforeTransmit: async () => ({ decision: 'apply', overrides: bad }),
          }),
        ).rejects.toThrow();
        expect(upload).not.toHaveBeenCalled();
      }
    });
  });

  it("'cancel' throws before upload", async () => {
    const { session, egress, upload } = makeSession();
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: overrides,
        beforeTransmit: async () => 'cancel',
      }),
    ).rejects.toBeInstanceOf(RadioWriteCancelledError);
    expect(upload).not.toHaveBeenCalled();
  });

  it("'keep' and a missing callback write as the no-override run does", async () => {
    const base = makeSession();
    await uploadPreparedRadioWrite(base.session, base.egress, undefined, {
      organisation,
      channels: [analogCh],
    });
    for (const beforeTransmit of [async () => 'keep' as const, undefined]) {
      const run = makeSession();
      await uploadPreparedRadioWrite(run.session, run.egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: overrides,
        beforeTransmit,
      });
      expect(run.upload).toHaveBeenCalledTimes(1);
      expect(run.intents[run.intents.length - 1]).toEqual(base.intents[0]);
    }
  });

  it('refuses a bad override before the pause', async () => {
    const { session, egress, upload } = makeSession();
    const beforeTransmit = vi.fn<(ctx: BeforeTransmitContext) => Promise<'apply'>>(
      async () => 'apply',
    );
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        organisation,
        channels: [analogCh],
        settingsOverrides: [{ fieldId: 'keyShortP1', value: 99 }],
        beforeTransmit,
      }),
    ).rejects.toThrow();
    expect(beforeTransmit).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('a write blocked by encode never reaches the pause', async () => {
    const { session, egress } = makeSession();
    const beforeTransmit = vi.fn<(ctx: BeforeTransmitContext) => Promise<'apply'>>(
      async () => 'apply',
    );
    await expect(
      uploadPreparedRadioWrite(session, egress, undefined, {
        organisation: { zones: [] },
        channels: [analogCh],
        settingsOverrides: overrides,
        beforeTransmit,
      }),
    ).rejects.toBeInstanceOf(RadioWriteBlockedError);
    expect(beforeTransmit).not.toHaveBeenCalled();
  });
});
