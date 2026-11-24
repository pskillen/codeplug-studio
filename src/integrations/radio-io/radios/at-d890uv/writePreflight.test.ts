import { describe, expect, it, vi } from 'vitest';
import { createRadioSession } from '../../kit/session.ts';
import { AtD890ScriptedPipe, localInfoWithSerial } from './__fixtures__/scriptedPipe.ts';
import { atD890ReadMemory } from './connection.ts';
import { AT_D890UV_DESCRIPTOR } from './descriptor.ts';
import { atD890WritePreflight } from './writePreflight.ts';
import { AtD890uvProtocol } from './protocol.ts';
import { D890_MAP } from './constants.ts';
import { getAtD890SessionSerial } from './programSession.ts';
import * as pendingUnits from './pendingUnits.ts';

const SERIAL = 'D890UV2401234567';

async function pipeWithSerial(): Promise<AtD890ScriptedPipe> {
  const pipe = new AtD890ScriptedPipe();
  pipe.autoAckWrites = true;
  const li = localInfoWithSerial(SERIAL);
  pipe.readResponder = (addr, len) => {
    const rel = addr - D890_MAP.LocalInfo;
    return rel >= 0 && rel + len <= li.length
      ? li.slice(rel, rel + len)
      : new Uint8Array(len).fill(0xff);
  };
  await atD890ReadMemory(pipe, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
  return pipe;
}

describe('atD890WritePreflight', () => {
  it('shows the serial in full', async () => {
    const pipe = await pipeWithSerial();
    expect(getAtD890SessionSerial(pipe)).toBe(SERIAL);
    const radio = new AtD890uvProtocol();
    vi.spyOn(radio, 'getIdentBandCode').mockReturnValue(3);
    vi.spyOn(radio, 'getDownloadCache').mockReturnValue({
      firmware: 'MM9PDY',
      blocks: new Map(),
    } as never);
    vi.spyOn(pendingUnits, 'findAtD890PendingBlock').mockReturnValue(null);
    const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
    const result = await atD890WritePreflight(session);
    expect(result.identity.serial).toBe(SERIAL);
    expect(result.rows.find((r) => r.label === 'Serial')?.value).toBe(SERIAL);
  });

  it('a hard pending block refuses with retry none', async () => {
    const pipe = await pipeWithSerial();
    const radio = new AtD890uvProtocol();
    vi.spyOn(pendingUnits, 'findAtD890PendingBlock').mockReturnValue({
      radios: [SERIAL],
      units: [0x3400000],
      recordedAt: new Date().toISOString(),
      interrupted: true,
      hard: true,
    });
    const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
    const result = await atD890WritePreflight(session);
    expect(result.refusal).toBeDefined();
    expect((result.refusal as { sent?: string }).sent).toBe('nothing-sent');
  });

  it('a soft pending block is a finding, not a refusal', async () => {
    const pipe = await pipeWithSerial();
    const radio = new AtD890uvProtocol();
    vi.spyOn(pendingUnits, 'findAtD890PendingBlock').mockReturnValue({
      radios: [SERIAL],
      units: [0x3400000],
      recordedAt: new Date().toISOString(),
      interrupted: true,
      hard: false,
    });
    const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
    const result = await atD890WritePreflight(session);
    expect(result.refusal).toBeUndefined();
    expect(result.findings?.length).toBe(1);
  });

  it('sends no frame', async () => {
    const pipe = new AtD890ScriptedPipe();
    const radio = new AtD890uvProtocol();
    vi.spyOn(pendingUnits, 'findAtD890PendingBlock').mockReturnValue(null);
    const session = createRadioSession({ descriptor: AT_D890UV_DESCRIPTOR, pipe, radio });
    const before = pipe.writes.length;
    await atD890WritePreflight(session);
    expect(pipe.writes.length).toBe(before);
  });
});
