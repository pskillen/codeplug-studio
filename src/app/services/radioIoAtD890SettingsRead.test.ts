import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as radioIo from '@integrations/radio-io/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  AtD890ScriptedPipe,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890Connect,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import {
  atD890SettingsReadFromSnapshot,
  readAtD890SettingsFromRadio,
  atD890SettingsTargetForEgress,
} from './radioIoAtD890SettingsRead.ts';

describe('atD890SettingsReadFromSnapshot', () => {
  it('decodes a snapshot into the page read without setting anything', () => {
    const localInfo = new Uint8Array(0x100);
    localInfo[0x04] = 1;
    new TextEncoder().encodeInto('SN00000099', localInfo.subarray(0x30));
    const read = atD890SettingsReadFromSnapshot(
      {
        localInfo,
        main: new Uint8Array(0x200),
        ext: new Uint8Array(0x60),
        masterId: new Uint8Array(0x40),
        bandCode: 3,
      },
      'stock',
      1234,
    );
    expect(read.bandCode).toBe(3);
    expect(read.readAt).toBe(1234);
    expect(read.languageLock).toBe(1);
    expect(read.serial).toContain('0099');
    expect(read.decoded.keyTone).toBeDefined();
  });

  it('picks the target from the egress profile', () => {
    expect(
      atD890SettingsTargetForEgress(newRadioBuildForProfile('p', 'radio-io-at-d890uv').egress),
    ).toBe('stock');
    expect(
      atD890SettingsTargetForEgress(
        newRadioBuildForProfile('p', 'radio-io-at-d890uv-mm9pdy').egress,
      ),
    ).toBe('mm9pdy');
  });
});

describe('readAtD890SettingsFromRadio (real service, scripted pipe)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Only the Web Serial edge is faked: the descriptor, session, protocol and close are real. */
  function scriptedRadio(opts?: { silentAfterConnect?: boolean }) {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const settings = makeAtD890EraseUnitBuffer();
    settings[0x13] = 7;
    scriptAtD890UploadReadResponder(
      pipe,
      new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial('SN-TEST-READ0001')],
        [0x350_0000, settings],
        [D890_MAP.MasterIdData, new Uint8Array(D890_MAP.MasterIdLength).fill(0x07)],
      ]),
    );
    if (opts?.silentAfterConnect) {
      const respond = pipe.readResponder!;
      pipe.readResponder = (addr, len) => {
        // Connect (LocalInfo) answers; the settings read then goes silent.
        if (addr >= 0x350_0000 && addr < 0x354_0000) return null;
        return respond(addr, len);
      };
    }
    const closeSpy = vi.spyOn(pipe, 'close');
    const port = {
      readable: null,
      writable: null,
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    vi.spyOn(radioIo, 'requestWebSerialPort').mockResolvedValue(port);
    vi.spyOn(radioIo, 'openWebSerialPipe').mockResolvedValue(pipe);
    return { pipe, closeSpy };
  }

  const egress = () => newRadioBuildForProfile('p', 'radio-io-at-d890uv').egress;
  const END = Array.from(new TextEncoder().encode('END'));
  const endFrames = (pipe: AtD890ScriptedPipe) =>
    pipe.writes.filter((w) => w.length === 3 && Array.from(w).every((b, i) => b === END[i]));
  const writeFrames = (pipe: AtD890ScriptedPipe) => pipe.writes.filter((w) => w[0] === 0x57);

  it('reads, then closes the session with END and sends no W frame', async () => {
    const { pipe, closeSpy } = scriptedRadio();

    const read = await readAtD890SettingsFromRadio(egress());

    expect(read.serial).toContain('0001');
    expect(read.decoded.keyTone).toBeDefined();
    expect(writeFrames(pipe)).toEqual([]);
    expect(endFrames(pipe)).toHaveLength(1);
    // END is the last thing on the wire, then the pipe closes once.
    expect(Array.from(pipe.writes[pipe.writes.length - 1]!)).toEqual(END);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('still closes with END and writes nothing when the read fails', async () => {
    const { pipe, closeSpy } = scriptedRadio({ silentAfterConnect: true });

    await expect(readAtD890SettingsFromRadio(egress())).rejects.toThrow();

    expect(writeFrames(pipe)).toEqual([]);
    expect(endFrames(pipe)).toHaveLength(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('still closes with END and writes nothing when the read is cancelled mid-read', async () => {
    const { pipe, closeSpy } = scriptedRadio();
    const controller = new AbortController();
    const respond = pipe.readResponder!;
    pipe.readResponder = (addr, len) => {
      // Cancel as the settings read starts (after connect's LocalInfo negotiation).
      if (addr >= 0x350_0000 && addr < 0x354_0000) controller.abort();
      return respond(addr, len);
    };

    await expect(
      readAtD890SettingsFromRadio(egress(), { signal: controller.signal }),
    ).rejects.toThrow();

    expect(writeFrames(pipe)).toEqual([]);
    expect(endFrames(pipe)).toHaveLength(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
