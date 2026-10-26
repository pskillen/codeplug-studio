import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as radioIo from '@integrations/radio-io/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890_STUN_KILL_UNKNOWN_MESSAGE } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AT_D890_STUN_KILL_MESSAGE,
  AtD890StunKillError,
} from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import {
  AtD890ScriptedPipe,
  localInfoWithSerial,
  scriptAtD890Connect,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import { readAtD890SettingsFromRadio } from './radioIoAtD890SettingsRead.ts';
import { uploadPreparedRadioWrite } from './radioIoSession.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
} from '@integrations/radio-io/radios/at-d890uv/memory.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';

function scriptedRadio(flags: readonly [number, number]) {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890Connect(pipe);
  const localInfo = localInfoWithSerial('SN-TEST-STUN0001');
  localInfo[0] = flags[0];
  localInfo[1] = flags[1];
  scriptAtD890UploadReadResponder(pipe, new Map([[D890_MAP.LocalInfo, localInfo]]));
  const port = {
    readable: null,
    writable: null,
    open: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
  vi.spyOn(radioIo, 'requestWebSerialPort').mockResolvedValue(port);
  vi.spyOn(radioIo, 'openWebSerialPipe').mockResolvedValue(pipe);
  return pipe;
}

const endFrames = (pipe: AtD890ScriptedPipe) =>
  pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
const writeFrames = (pipe: AtD890ScriptedPipe) => pipe.writes.filter((w) => w[0] === 0x57);
const egress = () => newRadioBuildForProfile('p', 'radio-io-at-d890uv').egress;

describe('AT-D890 stun/kill flag through the real session service (#1288)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['01 00', [1, 0] as const],
    ['00 01', [0, 1] as const],
  ])(
    'a read session on a radio with flags %s sends no END and tells the user',
    async (_l, flags) => {
      const pipe = scriptedRadio(flags);
      await expect(readAtD890SettingsFromRadio(egress())).rejects.toThrow(
        AT_D890_STUN_KILL_MESSAGE,
      );
      expect(endFrames(pipe)).toHaveLength(0);
      expect(writeFrames(pipe)).toEqual([]);
    },
  );

  it('keeps the AtD890StunKillError class and adds no baud note', async () => {
    scriptedRadio([1, 0]);
    const err = await readAtD890SettingsFromRadio(egress()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AtD890StunKillError);
    expect((err as Error).message).not.toMatch(/tried baud/);
  });

  it('a read session whose LocalInfo cannot be read sends no END and says to power-cycle', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const port = {
      readable: null,
      writable: null,
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    vi.spyOn(radioIo, 'requestWebSerialPort').mockResolvedValue(port);
    vi.spyOn(radioIo, 'openWebSerialPipe').mockResolvedValue(pipe);
    await expect(readAtD890SettingsFromRadio(egress())).rejects.toThrow(
      AT_D890_STUN_KILL_UNKNOWN_MESSAGE,
    );
    expect(endFrames(pipe)).toHaveLength(0);
    expect(writeFrames(pipe)).toEqual([]);
  });

  it('uploadPreparedRadioWrite on a flagged radio sends no W frame and no END', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe, 0xf0, [1, 0]);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    radio.seedDownloadCache({
      blocks: new Map([[D890_MAP.LocalInfo, localInfoWithSerial('SN-FLAG')]]),
    });
    const cache = radio.getDownloadCache()!;
    putCacheBytes(cache, D890_MAP.RadioIdSet, new Uint8Array(0x20));
    putCacheBytes(cache, D890_MAP.ChannelSet, new Uint8Array(0x200));
    putCacheBytes(cache, channelPrimaryAddress(0), new Uint8Array(0x40));
    putCacheBytes(cache, channelSecondaryAddress(0), new Uint8Array(0x40));
    putCacheBytes(cache, D890_MAP.ZoneSet, new Uint8Array(0x20));
    putCacheBytes(cache, D890_MAP.ZoneHide, new Uint8Array(0x20).fill(0xff));
    putCacheBytes(cache, D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff));
    const session: RadioSession = { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio };
    await expect(
      uploadPreparedRadioWrite(session, egress(), undefined, {
        organisation: { zones: [{ wireName: 'Z1', channelNumbers: [1] }] },
        channels: [
          {
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
          },
        ],
        beforeTransmit: async () => 'apply',
      }),
    ).rejects.toBeInstanceOf(AtD890StunKillError);
    expect(writeFrames(pipe)).toEqual([]);
    await radio.disconnect();
    expect(endFrames(pipe)).toHaveLength(0);
  });

  it('flags 00 00: the read session still ends with END', async () => {
    const pipe = scriptedRadio([0, 0]);
    await readAtD890SettingsFromRadio(egress());
    expect(endFrames(pipe)).toHaveLength(1);
  });
});
