import { describe, expect, it } from 'vitest';
import { DM32_FACTORY_SECTOR_LENGTH, DM32_FACTORY_SECTOR_READ_FRAME } from './constants.ts';
import { dm32CaptureFactorySector } from './connection.ts';
import { Dm32uvProtocol } from './protocol.ts';
import {
  Dm32ScriptedPipe,
  enqueueDm32FactorySectorReply,
  scriptDm32Connect,
} from './__fixtures__/scriptedPipe.ts';

const EFUSE = Uint8Array.from([
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x11, 0x22, 0x33, 0x44,
]);

function sector(marker: number): Uint8Array {
  const data = new Uint8Array(DM32_FACTORY_SECTOR_LENGTH);
  data[0x80] = marker;
  data[0xa1] = 0xa5;
  return data;
}

function factoryWrites(pipe: Dm32ScriptedPipe): Uint8Array[] {
  return pipe.writes.filter((frame) => frame.byteLength === 6 && frame[0] === 0x47);
}

/** ASCII `SYSINFO` starts with `0x53`. That handshake is not opcode `0x53`. */
function isEraseOpcodeFrame(frame: Uint8Array): boolean {
  if (frame[0] !== 0x43 && frame[0] !== 0x53) return false;
  const text = new TextDecoder('ascii').decode(frame);
  return text !== 'SYSINFO';
}

function expectOnlyBackupReadFrames(pipe: Dm32ScriptedPipe): void {
  const frames = factoryWrites(pipe);
  expect(frames).toHaveLength(2);
  expect(frames[0]).toEqual(DM32_FACTORY_SECTOR_READ_FRAME);
  expect(frames[1]).toEqual(DM32_FACTORY_SECTOR_READ_FRAME);
  expect(pipe.writes.some(isEraseOpcodeFrame)).toBe(false);
}

describe('dm32CaptureFactorySector', () => {
  it('keeps the 4096 bytes when both replies match and sends only the backup read', async () => {
    const pipe = new Dm32ScriptedPipe();
    const payload = sector(0x04);
    enqueueDm32FactorySectorReply(pipe, payload);
    enqueueDm32FactorySectorReply(pipe, payload.slice());

    const capture = await dm32CaptureFactorySector(pipe, { settleScale: 0 });
    expect(capture.status).toBe('kept');
    if (capture.status === 'kept') expect(capture.bytes).toEqual(payload);
    expectOnlyBackupReadFrames(pipe);
  });

  it('drops both copies when the payloads differ and does not send a third read', async () => {
    const pipe = new Dm32ScriptedPipe();
    enqueueDm32FactorySectorReply(pipe, sector(0x04));
    enqueueDm32FactorySectorReply(pipe, sector(0x00));

    const capture = await dm32CaptureFactorySector(pipe, { settleScale: 0 });
    expect(capture).toEqual({ status: 'not-kept', reason: 'mismatch' });
    expectOnlyBackupReadFrames(pipe);
  });

  it('keeps nothing when a reply is short', async () => {
    const pipe = new Dm32ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x53]));
    pipe.enqueue(new Uint8Array([0x53]));

    const capture = await dm32CaptureFactorySector(pipe, { settleScale: 0 });
    expect(capture).toEqual({ status: 'not-kept', reason: 'failed' });
    expectOnlyBackupReadFrames(pipe);
  });
});

describe('Dm32uvProtocol factory-sector connect', () => {
  it('does not send 0x47 unless backup sets captureFactorySector', async () => {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32Connect(pipe);
    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });
    expect(factoryWrites(pipe)).toEqual([]);
    expect(pipe.writes.some(isEraseOpcodeFrame)).toBe(false);
    expect(radio.getFactorySector()).toBeNull();
    expect(radio.getFactorySectorCapture()).toEqual({ status: 'not-requested' });
    expect(radio.getEfuseIdentity()).toBeNull();
  });

  it('keeps a matching sector and the eFuse payload, and still finishes connect', async () => {
    const pipe = new Dm32ScriptedPipe();
    const payload = sector(0x04);
    scriptDm32Connect(pipe, {
      factorySectorReplies: [payload, payload.slice()],
      efusePayload: EFUSE,
    });
    const radio = new Dm32uvProtocol();
    const ident = await radio.connect(pipe, { settleScale: 0, captureFactorySector: true });
    expect(ident.modelHints).toContain('DM-32UV');
    expect(radio.getFactorySector()).toEqual(payload);
    expect(radio.getFactorySectorCapture().status).toBe('kept');
    expect(radio.getEfuseIdentity()).toEqual(EFUSE);
    expectOnlyBackupReadFrames(pipe);
  });

  it('continues the backup connect when the two factory-sector reads disagree', async () => {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32Connect(pipe, {
      factorySectorReplies: [sector(0x04), sector(0x01)],
    });
    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0, captureFactorySector: true });
    expect(radio.getFactorySector()).toBeNull();
    expect(radio.getFactorySectorCapture()).toEqual({ status: 'not-kept', reason: 'mismatch' });
    expect(radio.getLiveConfigWindow()).toEqual({ start: 0x1000, end: 0x2000 });
    expectOnlyBackupReadFrames(pipe);
  });
});
