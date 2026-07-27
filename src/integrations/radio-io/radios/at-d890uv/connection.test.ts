import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { D890_MAP } from './constants.ts';
import { atD890WriteMemory } from './connection.ts';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

describe('atD890WriteMemory allow-list', () => {
  it('refuses LocalInfo before serial I/O', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(atD890WriteMemory(pipe, D890_MAP.LocalInfo, new Uint8Array(0x10))).rejects.toThrow(
      RadioProtocolError,
    );
    expect(pipe.writes).toHaveLength(0);
  });
});
