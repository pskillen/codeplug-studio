import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { D890_MAP } from './constants.ts';
import { AtD890uvProtocol, AT_D890_STUN_KILL_UNKNOWN_MESSAGE } from './protocol.ts';
import { AT_D890_STUN_KILL_MESSAGE } from './stunKillGuard.ts';
import {
  AtD890ScriptedPipe,
  collectAtD890ReadRequestAddresses,
  scriptAtD890Connect,
  scriptAtD890ConnectWithNegotiation,
} from './__fixtures__/scriptedPipe.ts';

const END = 'END';

function endFrames(pipe: AtD890ScriptedPipe): number {
  return pipe.writes.filter((w) => new TextDecoder().decode(w) === END).length;
}

function writeFrames(pipe: AtD890ScriptedPipe): number {
  return pipe.writes.filter((w) => w[0] === 0x57).length;
}

async function connected(flags: readonly [number, number]) {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe, 0xf0, flags);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  return { pipe, radio };
}

describe('AT-D890 stun/kill guard (#1288)', () => {
  it('flags 00 00: healthy, END is sent', async () => {
    const { pipe, radio } = await connected([0, 0]);
    expect(radio.hasStunKillFlag()).toBe(false);
    expect(() => radio.assertNoStunKillFlag()).not.toThrow();
    await radio.disconnect();
    expect(endFrames(pipe)).toBe(1);
  });

  it('Connect adds no read of its own: a healthy and a flagged radio see the same frames', async () => {
    const healthy = await connected([0, 0]);
    const flagged = await connected([1, 0]);
    expect(collectAtD890ReadRequestAddresses(flagged.pipe)).toEqual(
      collectAtD890ReadRequestAddresses(healthy.pipe),
    );
    expect(flagged.pipe.writes.length).toBe(healthy.pipe.writes.length);
  });

  describe('when LocalInfo cannot be read (state unknown)', () => {
    async function unreadable() {
      // No readResponder and nothing queued: the probe and the direct read both fail.
      const pipe = new AtD890ScriptedPipe();
      scriptAtD890Connect(pipe);
      const radio = new AtD890uvProtocol();
      await radio.connect(pipe);
      return { pipe, radio };
    }

    it('is treated like a set flag: no END, and the user is told to power-cycle', async () => {
      const { pipe, radio } = await unreadable();
      expect(radio.hasStunKillFlag()).toBe(false);
      expect(radio.stunKillStateUnknown()).toBe(true);
      expect(radio.mustNotEnd()).toBe(true);
      expect(() => radio.assertNoStunKillFlag()).toThrow(AT_D890_STUN_KILL_UNKNOWN_MESSAGE);
      expect(AT_D890_STUN_KILL_UNKNOWN_MESSAGE).toMatch(/Power-cycle/);
      await radio.disconnect();
      expect(endFrames(pipe)).toBe(0);
    });

    it('aborts any write before a W frame', async () => {
      const { pipe, radio } = await unreadable();
      await expect(
        radio.uploadSettingsPatches(
          [
            {
              fieldId: 'keyTone',
              address: 0x350_0000 + 0x20,
              bytes: new Uint8Array([0]),
              mask: new Uint8Array([1]),
            },
          ],
          {},
        ),
      ).rejects.toThrow(AT_D890_STUN_KILL_UNKNOWN_MESSAGE);
      expect(writeFrames(pipe)).toBe(0);
    });
  });

  it.each([
    ['01 00', [1, 0] as const],
    ['00 01', [0, 1] as const],
    ['ff ff', [0xff, 0xff] as const],
  ])('flags %s: no END on disconnect, and a clear message', async (_label, flags) => {
    const { pipe, radio } = await connected(flags);
    expect(radio.hasStunKillFlag()).toBe(true);
    expect(() => radio.assertNoStunKillFlag()).toThrow(AT_D890_STUN_KILL_MESSAGE);
    await radio.disconnect();
    expect(endFrames(pipe)).toBe(0);
    expect(AT_D890_STUN_KILL_MESSAGE).toMatch(/stun or kill/);
    expect(AT_D890_STUN_KILL_MESSAGE).toMatch(/Power-cycle/);
  });

  it('flags set: upload aborts before any W frame', async () => {
    const { pipe, radio } = await connected([0, 1]);
    radio.seedDownloadCache({ blocks: new Map([[D890_MAP.LocalInfo, new Uint8Array(0x100)]]) });
    const image = (await import('./memory.ts')).cacheToMemoryMap(radio.getDownloadCache()!);
    await expect(radio.upload(image, {})).rejects.toThrow(RadioProtocolError);
    expect(writeFrames(pipe)).toBe(0);
  });

  it('flags set: a settings-only upload aborts before any W frame', async () => {
    const { pipe, radio } = await connected([1, 0]);
    await expect(
      radio.uploadSettingsPatches(
        [
          {
            fieldId: 'keyTone',
            address: 0x350_0000 + 0x20,
            bytes: new Uint8Array([0]),
            mask: new Uint8Array([1]),
          },
        ],
        {},
      ),
    ).rejects.toThrow(AT_D890_STUN_KILL_MESSAGE);
    expect(writeFrames(pipe)).toBe(0);
  });
});
