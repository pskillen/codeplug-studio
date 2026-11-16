import { describe, expect, it } from 'vitest';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import { D890_MAP } from './constants.ts';
import { endAtD890ReadSession, endAtD890WithLocalInfo } from './stunKillGuard.ts';

const sentEnd = (pipe: AtD890ScriptedPipe) =>
  pipe.writes.some((frame) => Array.from(frame).join(',') === '69,78,68');

describe('read-session END guard', () => {
  it.each([
    [0, 0],
    [1, 0],
    [0, 1],
  ])('checks flags %i, %i', async (stun, kill) => {
    const pipe = new AtD890ScriptedPipe();
    pipe.readResponder = (address, length) => {
      expect(address).toBe(D890_MAP.LocalInfo);
      const bytes = new Uint8Array(length);
      bytes[0] = stun;
      bytes[1] = kill;
      return bytes;
    };
    if (stun || kill) await expect(endAtD890ReadSession(pipe)).rejects.toThrow(/Power-cycle/);
    else await endAtD890ReadSession(pipe);
    expect(sentEnd(pipe)).toBe(!stun && !kill);
  });

  it('refuses END when the flags cannot be read', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(endAtD890ReadSession(pipe)).rejects.toThrow(/Power-cycle/);
    expect(sentEnd(pipe)).toBe(false);
  });
});

describe('pre-write snapshot END guard', () => {
  it.each([null, new Uint8Array([1, 0]), new Uint8Array([0, 1])])(
    'refuses an unknown or flagged snapshot',
    async (flags) => {
      const pipe = new AtD890ScriptedPipe();
      await expect(endAtD890WithLocalInfo(pipe, flags)).rejects.toThrow(/Power-cycle/);
      expect(sentEnd(pipe)).toBe(false);
    },
  );
});
