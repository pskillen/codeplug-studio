import { describe, expect, it } from 'vitest';
import { decodeDebugFrame } from '../../../kit/codecs/radioFoundryDebugLink.ts';
import { RadioInterlockError } from '../../../kit/errors.ts';
import { CODEPLUG_COMMAND } from '../constants.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from '../storageInfo.ts';
import { RADIOFOUNDRY_VERSION_COMMAND } from '../version.ts';
import { RADIOFOUNDRY_INFO_CHIP_COMMAND } from './chipInfo.ts';
import {
  createStorageClaimSender,
  guardStorageClaimCommand,
  STORAGE_OP_READ,
  StorageClaimSendRefusedError,
} from './storageClaimSend.ts';
import { StorageClaimScriptedPipe } from './__fixtures__/storageClaimScriptedPipe.ts';

describe('storage claim allow-list (interlock 1)', () => {
  it('refuses CODEPLUG 0x1C with nothing written to the pipe', () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.silent = true;
    const sender = createStorageClaimSender(pipe);
    expect(() => guardStorageClaimCommand(CODEPLUG_COMMAND, new Uint8Array([0]))).toThrow(
      StorageClaimSendRefusedError,
    );
    expect(pipe.writes).toHaveLength(0);
    void sender;
  });

  it('refuses STORAGE op 3 and unknown commands', () => {
    expect(() =>
      guardStorageClaimCommand(RADIOFOUNDRY_STORAGE_COMMAND, new Uint8Array([3])),
    ).toThrow(/STORAGE operation 3/);
    expect(() => guardStorageClaimCommand(0x26, new Uint8Array([0]))).toThrow(/does not send/);
  });

  it('permits VERSION, INFO_CHIP and STORAGE ops 0 1 2', async () => {
    const pipe = new StorageClaimScriptedPipe();
    const sender = createStorageClaimSender(pipe);
    await sender.exchangeVersion();
    await sender.exchangeInfoChip();
    await sender.exchangeStorage(0, new Uint8Array(), 2000);
    const cmds = pipe.writes.map((w) => decodeDebugFrame(w).command);
    expect(cmds).toEqual([
      RADIOFOUNDRY_VERSION_COMMAND,
      RADIOFOUNDRY_INFO_CHIP_COMMAND,
      RADIOFOUNDRY_STORAGE_COMMAND,
    ]);
  });

  it('refuses a second CLAIM in the same session', async () => {
    const pipe = new StorageClaimScriptedPipe();
    const sender = createStorageClaimSender(pipe);
    const token = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
    await sender.exchangeStorage(2, token, 5000);
    await expect(sender.exchangeStorage(2, token, 5000)).rejects.toBeInstanceOf(
      StorageClaimSendRefusedError,
    );
  });
});

describe('one CLAIM, whatever the reply (interlock 9)', () => {
  const token = new Uint8Array([0x78, 0x56, 0x34, 0x12]);
  const claims = (pipe: StorageClaimScriptedPipe) =>
    pipe.writes.filter((w) => {
      const f = decodeDebugFrame(w);
      return f.command === RADIOFOUNDRY_STORAGE_COMMAND && f.payload[0] === 2;
    }).length;

  it('counts a CLAIM whose reply never came as sent, and refuses a second', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.silent = true;
    const sender = createStorageClaimSender(pipe);
    await expect(sender.exchangeStorage(2, token, 50)).rejects.toThrow();
    expect(sender.claimSent).toBe(true);
    await expect(sender.exchangeStorage(2, token, 50)).rejects.toBeInstanceOf(
      StorageClaimSendRefusedError,
    );
    expect(claims(pipe)).toBe(1);
  });

  it('does not resend CLAIM when the radio answers busy', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.claimStatusOverride = 3;
    const sender = createStorageClaimSender(pipe);
    const reply = await sender.exchangeStorage(2, token, 2000);
    expect(reply.status).toBe(3);
    expect(claims(pipe)).toBe(1);
    expect(sender.claimSent).toBe(true);
  });
});

describe('guard STORAGE READ length', () => {
  it('refuses READ len 0 before write', () => {
    const payload = new Uint8Array([STORAGE_OP_READ, 0, 0, 0x10, 0x01, 0, 0]);
    expect(() => guardStorageClaimCommand(RADIOFOUNDRY_STORAGE_COMMAND, payload)).toThrow(
      RadioInterlockError,
    );
  });
});
