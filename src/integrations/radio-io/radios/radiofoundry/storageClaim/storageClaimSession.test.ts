import { describe, expect, it } from 'vitest';
import { decodeDebugFrame } from '../../../kit/codecs/radioFoundryDebugLink.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from '../board.ts';
import { RADIOFOUNDRY_STORAGE_COMMAND } from '../storageInfo.ts';
import {
  assertSaneStorageClaimRanges,
  StorageClaimRulesError,
} from '@core/radios/radiofoundry/storageClaim.ts';
import {
  createStorageClaimSession,
  storageClaimAcknowledgeBackupSaved,
  storageClaimBackup,
  storageClaimCheck,
  storageClaimPollForOurs,
  storageClaimUnlock,
} from './storageClaimSession.ts';
import { StorageClaimSendRefusedError } from './storageClaimSend.ts';
import { StorageClaimScriptedPipe } from './__fixtures__/storageClaimScriptedPipe.ts';

describe('storage claim session interlocks', () => {
  it('interlock 2: refuses when VERSION board is not in the build', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.versionText = 'board=WRONG\n';
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await expect(storageClaimCheck(state)).rejects.toMatchObject({
      name: 'StorageClaimSessionError',
    });
    expect(pipe.writes.length).toBeLessThanOrEqual(1);
  });

  it('interlock 3: refuses READ before foreign INFO', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.storageRegion = 1;
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await expect(storageClaimCheck(state)).rejects.toThrow(/already belongs/);
    await expect(storageClaimBackup(state)).rejects.toThrow(/foreign/);
  });

  it('interlock 4: sane ranges refuse bad journal size', () => {
    expect(() =>
      assertSaneStorageClaimRanges([
        { kind: 'settings', address: 0x711000, size: 0x8000 },
        { kind: 'journal', address: 0x719000, size: 0x3000 },
      ]),
    ).toThrow(StorageClaimRulesError);
  });

  it('interlock 5: backup refuses when the second full read differs by one byte', async () => {
    class MismatchPipe extends StorageClaimScriptedPipe {
      settingsPass = 0;
      constructor() {
        super();
        this.settingsSize = 4096;
        this.journalSize = 0;
        this.calSize = 0;
      }
      override async write(data: Uint8Array): Promise<void> {
        const req = decodeDebugFrame(data);
        if (req.command === RADIOFOUNDRY_STORAGE_COMMAND && req.payload[0] === 1) {
          const addr =
            req.payload[1]! |
            (req.payload[2]! << 8) |
            (req.payload[3]! << 16) |
            (req.payload[4]! << 24);
          const len = req.payload[5]! | (req.payload[6]! << 8);
          const key = `${(addr >>> 0).toString(16)}:${len}`;
          if (this.settingsPass === 0) {
            this.storageReadData.set(key, new Uint8Array(len).fill(0xaa));
          } else {
            this.storageReadData.set(key, new Uint8Array(len).fill(0xbb));
          }
          this.settingsPass += 1;
        }
        await super.write(data);
      }
    }
    const pipe = new MismatchPipe();
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    await expect(storageClaimBackup(state)).rejects.toThrow(/second read/);
  });

  it('interlock 6: refuses unlock without backup tick', async () => {
    const pipe = new StorageClaimScriptedPipe();
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    state.manifestToken = pipe.chipToken;
    state.manifestLayout = state.storageInfo;
    await expect(storageClaimUnlock(state)).rejects.toThrow(/saved the backup/);
  });

  it('interlock 7: INFO_CHIP status 4 refuses with the update message', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.chipStatus = 4;
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    await expect(storageClaimBackup(state)).rejects.toThrow(/22 Oct 2026/);
  });

  it('interlock 8: fresh INFO before CLAIM must match manifest', async () => {
    const pipe = new StorageClaimScriptedPipe();
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    await storageClaimBackup(state);
    storageClaimAcknowledgeBackupSaved(state);
    pipe.settingsSize = 0x7000;
    await expect(storageClaimUnlock(state)).rejects.toThrow(/layout changed/);
  });

  it('interlock 9: one CLAIM per session', async () => {
    const pipe = new StorageClaimScriptedPipe();
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    await storageClaimBackup(state);
    storageClaimAcknowledgeBackupSaved(state);
    await storageClaimUnlock(state);
    await expect(storageClaimUnlock(state)).rejects.toBeInstanceOf(StorageClaimSendRefusedError);
  });

  it('poll sees ours when the radio reports region 1', async () => {
    const pipe = new StorageClaimScriptedPipe();
    pipe.afterClaimRegion = 1;
    const state = createStorageClaimSession(pipe, DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await storageClaimCheck(state);
    await storageClaimBackup(state);
    storageClaimAcknowledgeBackupSaved(state);
    await storageClaimUnlock(state);
    const poll = await storageClaimPollForOurs(state);
    expect(poll.kind).toBe('ours');
  });
});
