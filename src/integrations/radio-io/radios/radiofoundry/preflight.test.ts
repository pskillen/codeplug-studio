import { describe, expect, it } from 'vitest';
import { RadioInterlockError } from '../../kit/errors.ts';
import { createRadioSession } from '../../kit/session.ts';
import { decodeDebugFrame } from '../../kit/codecs/radioFoundryDebugLink.ts';
import { CODEPLUG_COMMAND, OP_READ, OP_SUMS } from './constants.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from './board.ts';
import { DM32_RADIOFOUNDRY_DESCRIPTOR } from './descriptor.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from './storageInfo.ts';
import {
  RadioFoundryCableProtocol,
  RF_STORAGE_NO_MAP,
  RF_STORAGE_NOT_READY,
  RF_STORAGE_NOT_STARTED,
  STORAGE_FOREIGN_REFUSAL,
} from './protocol.ts';
import { radioFoundryWritePreflight } from './writePreflight.ts';
import { ScriptedPipe } from './protocol.test.ts';

describe('RadioFoundry write pre-flight', () => {
  it('pre-flight sends only INFO, VERSION and STORAGE op 0 before refusing', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageRegion = 2;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const beforePreflight = pipe.writes.length;
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal).toBeInstanceOf(RadioInterlockError);
    const afterOps = pipe.writes.slice(beforePreflight).map((w) => {
      const frame = decodeDebugFrame(w);
      if (frame.command === CODEPLUG_COMMAND) return frame.payload[0]!;
      return frame.command;
    });
    expect(afterOps).not.toContain(OP_SUMS);
    expect(afterOps).not.toContain(OP_READ);
    expect(afterOps.filter((c) => c === RADIOFOUNDRY_STORAGE_COMMAND)).toHaveLength(1);
  });

  it('foreign storage refuses with the claim message', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageRegion = 2;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal?.message).toBe(STORAGE_FOREIGN_REFUSAL);
  });

  it('region none refuses with the did-not-start message', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageRegion = 0;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal?.message).toBe(RF_STORAGE_NOT_STARTED);
  });

  it('status 4 refuses with the no-map message', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageStatus = 4;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal?.message).toBe(RF_STORAGE_NO_MAP);
  });

  it('status 1 refuses with the not-ready message', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageStatus = 1;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal?.message).toBe(RF_STORAGE_NOT_READY);
  });

  it('writable storage passes with a Storage writable row', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x02;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    expect(result.refusal).toBeUndefined();
    expect(result.rows.some((r) => r.label === 'Storage' && r.value === 'writable')).toBe(true);
  });

  it('readStorageInfo never sends op 1 or op 2', async () => {
    const pipe = new ScriptedPipe(0xff);
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const before = pipe.writes.length;
    await proto.readStorageInfo();
    const storageFrames = pipe.writes.slice(before).map((w) => decodeDebugFrame(w));
    for (const frame of storageFrames) {
      expect(frame.command).toBe(RADIOFOUNDRY_STORAGE_COMMAND);
      expect(frame.payload[0]).toBe(0);
    }
  });

  it('every storage refusal is retry none, nothing sent, with debug text', async () => {
    const pipe = new ScriptedPipe(0xff);
    pipe.infoFlags = 0x00;
    pipe.storageRegion = 2;
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const result = await radioFoundryWritePreflight(session, {});
    const err = result.refusal as RadioInterlockError;
    expect(err.retry).toBe('none');
    expect(err.sent).toBe('nothing-sent');
    expect(err.debugText).toContain('STORAGE INFO:');
  });
});
