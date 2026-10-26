import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as radioIo from '@integrations/radio-io/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890_STUN_KILL_UNKNOWN_MESSAGE } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { AT_D890_STUN_KILL_MESSAGE } from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import {
  AtD890ScriptedPipe,
  localInfoWithSerial,
  scriptAtD890Connect,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import { readAtD890SettingsFromRadio } from './radioIoAtD890SettingsRead.ts';

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

  it('flags 00 00: the read session still ends with END', async () => {
    const pipe = scriptedRadio([0, 0]);
    await readAtD890SettingsFromRadio(egress());
    expect(endFrames(pipe)).toHaveLength(1);
  });
});
