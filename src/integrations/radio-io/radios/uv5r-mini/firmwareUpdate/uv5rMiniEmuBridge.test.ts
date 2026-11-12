/**
 * Local-only: Studio's real UV-5R Mini pipeline against the firmware project's emulator, through its TCP serial bridge.
 * `resolveStockFirmware` -> `prepareFirmwareImage` with a release patch -> `checkImage` -> `openWebSerialPipe` (9600,
 * DTR/RTS low) -> the Mini updater's `identify` and `flash`, the rate change to 38400 included. Skipped in CI: it needs
 * the firmware project's bridge running and the operator's own stock image, neither of which is in this repository.
 *
 * Variables (a case is skipped unless all of its own are set):
 * - `UV5RMINI_STOCK_UFW`: the stock `.ufw` (nrfb-v0.04), outside the repo.
 * - `UV5RMINI_PATCH`: a release patch for that stock.
 * - `UV5RMINI_EMU_BRIDGE=127.0.0.1:<port>`: a fresh bridge for the clean case.
 * - `UV5RMINI_EMU_BRIDGE_CUT=127.0.0.1:<port>`: another fresh bridge for the cut-and-continue case (a bridge serves one
 *   client, then exits).
 * - `UV5RMINI_EMU_CUT_AFTER`: the loader erase/program count the power is cut after (default 100, inside the area).
 *
 * Bytes are read in memory only. The test prints a summary (result, phases, durations) and the bridge's STATUS.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FirmwareFlashError } from '../../../firmware/errors.ts';
import type { FirmwareFlashPhase, FirmwareFlashProgress } from '../../../firmware/types.ts';
import { createUserPatchSource } from '../../../../../core/firmware/releases/userPatchSource.ts';
import { resolveStockFirmware } from '../../../../../core/firmware/stock/resolveStockFirmware.ts';
import {
  getStockFirmwareDescriptor,
  listStockFirmwareDescriptors,
} from '../../../../../core/firmware/stockCatalog.ts';
import {
  prepareFirmwareImage,
  type PreparedFirmwareImage,
} from '../../../../../core/services/firmware/prepareFirmwareImage.ts';
import type { BytePipe } from '../../../types.ts';
import { openWebSerialPipe } from '../../../transport/webSerialPipe.ts';
import {
  connectBridgeSerialPort,
  type BridgeSerialPort,
  type BridgeStatus,
} from './__fixtures__/bridgeSerialPort.ts';
import { UV5RMINI_FW_LOADER_BAUD } from './frames.ts';
import { createUv5rMiniFirmwareUpdater } from './updater.ts';

const RADIO_ID = 'baofeng-uv5rmini';
const stockPath = process.env.UV5RMINI_STOCK_UFW;
const patchPath = process.env.UV5RMINI_PATCH;
const cleanBridge = process.env.UV5RMINI_EMU_BRIDGE;
const cutBridge = process.env.UV5RMINI_EMU_BRIDGE_CUT;
const cutAfter = Number(process.env.UV5RMINI_EMU_CUT_AFTER ?? '100');

const file = (path: string) => ({
  name: basename(path),
  bytes: new Uint8Array(readFileSync(path)),
});

/** The pipeline Studio runs up to the flash, on the operator's own files. */
async function prepare(): Promise<PreparedFirmwareImage> {
  const descriptor = getStockFirmwareDescriptor(RADIO_ID);
  const stock = await resolveStockFirmware(descriptor, [file(stockPath!)], {
    otherDescriptors: listStockFirmwareDescriptors().filter((d) => d.radioId !== RADIO_ID),
  });
  const source = createUserPatchSource(file(patchPath!), { rows: [] });
  const [summary] = await source.listReleases(RADIO_ID, { includeRc: true });
  const patch = await source.loadPatch(RADIO_ID, summary!.key);
  expect(patch.provenance).toBe('unreviewed');
  const image = await prepareFirmwareImage({ descriptor, stock, target: { kind: 'patch', patch } });
  createUv5rMiniFirmwareUpdater().checkImage(image);
  return image;
}

/** Phases in the order first seen. */
function phaseRecorder() {
  const phases: FirmwareFlashPhase[] = [];
  return {
    phases,
    onProgress: (p: FirmwareFlashProgress) => {
      if (phases[phases.length - 1] !== p.phase) phases.push(p.phase);
    },
  };
}

const secs = (ms: number) => (ms / 1000).toFixed(1);

/** From the last byte written to the next open at the loader rate: what a reopen costs the host (drain, close, open). */
function reopenMs(bridge: BridgeSerialPort, from = 0, to?: number): number[] {
  const out: number[] = [];
  let wroteAt: number | undefined;
  for (const c of bridge.calls.slice(from, to)) {
    if (c.type === 'write') wroteAt = c.at;
    else if (c.type === 'open' && c.baudRate === UV5RMINI_FW_LOADER_BAUD && wroteAt !== undefined) {
      out.push(c.at - wroteAt);
      wroteAt = undefined;
    }
  }
  return out;
}

async function closeAll(pipe: BytePipe | undefined, bridge: BridgeSerialPort | undefined) {
  await pipe?.close().catch(() => undefined);
  await bridge?.port.close().catch(() => undefined);
}

function report(label: string, lines: Record<string, unknown>, status: BridgeStatus) {
  // The flash hash is radio data: left out of anything printed.
  const rest = { ...status, flash_sha256: undefined };
  console.log(
    `[uv5rmini-emu-bridge] ${label} ${JSON.stringify(lines)} STATUS ${JSON.stringify(rest)}`,
  );
}

describe.skipIf(!stockPath || !patchPath)('UV-5R Mini updater against the emulator bridge', () => {
  it.skipIf(!cleanBridge)(
    'clean update ends with result 0',
    async () => {
      const image = await prepare();
      const bridge = await connectBridgeSerialPort(cleanBridge!);
      let pipe: BytePipe | undefined;
      try {
        const started = Date.now();
        pipe = await openWebSerialPipe(bridge.port, 9600, { raiseDtrRts: false });
        const updater = createUv5rMiniFirmwareUpdater();
        const ident = await updater.identify(pipe, {});
        const { phases, onProgress } = phaseRecorder();
        let result;
        try {
          result = await updater.flash(image, { onProgress });
        } catch (err) {
          console.log(
            `[uv5rmini-emu-bridge] clean failed at ${(err as FirmwareFlashError).position}, phases ${phases.join(',')}\n` +
              bridge.trace.slice(-30).join('\n'),
          );
          throw err;
        }
        const wall = Date.now() - started;
        const status = await bridge.status();

        report(
          'clean',
          {
            ident: ident.version,
            end: result.end,
            note: result.note,
            phases,
            framesSent: result.framesSent,
            dataFrames: result.dataFrames,
            flashMs: result.elapsedMs,
            wallS: secs(wall),
            reopenMs: reopenMs(bridge),
          },
          status,
        );

        expect(result.end).toBe('acknowledged');
        expect(status.result).toBe(0);
        expect(phases).toEqual(['handshake', 'erase', 'transfer', 'finish']);
        expect(bridge.calls.filter((c) => c.type === 'open').map((c) => c.baudRate)).toEqual([
          9600,
          UV5RMINI_FW_LOADER_BAUD,
        ]);
        expect(status.outside).toEqual([]);
        expect(status.area).toEqual([0x4000, 0x7c000]);
        expect(status.matches_prediction).toBe(true);
        // DTR and RTS were never raised.
        for (const c of bridge.calls) {
          if (c.type === 'setSignals') {
            expect(c.signals.dataTerminalReady ?? false).toBe(false);
            expect(c.signals.requestToSend ?? false).toBe(false);
          }
        }
      } finally {
        await closeAll(pipe, bridge);
        await bridge.dispose();
      }
    },
    15 * 60_000,
  );

  it.skipIf(!cutBridge)(
    'cut and continue ends with result 0',
    async () => {
      const image = await prepare();
      const bridge = await connectBridgeSerialPort(cutBridge!);
      let pipe: BytePipe | undefined;
      try {
        const started = Date.now();
        pipe = await openWebSerialPipe(bridge.port, 9600, { raiseDtrRts: false });
        await bridge.cut(cutAfter);
        const first = createUv5rMiniFirmwareUpdater();
        await first.identify(pipe, {});
        const rec1 = phaseRecorder();

        // The radio goes silent at the cut; the host would wait out the idle timeout, so stop it once the bridge says dead.
        const abort = new AbortController();
        const watch = setInterval(() => {
          bridge
            .status()
            .then((s) => {
              if (s.stage === 'dead') abort.abort();
            })
            .catch(() => undefined);
        }, 1000);
        let cutError: unknown;
        try {
          await first.flash(image, { onProgress: rec1.onProgress, signal: abort.signal });
        } catch (err) {
          cutError = err;
        } finally {
          clearInterval(watch);
        }
        const afterCut = await bridge.status();
        const cutWall = Date.now() - started;
        expect(afterCut.stage).toBe('dead');
        expect(cutError).toBeInstanceOf(FirmwareFlashError);
        expect((cutError as FirmwareFlashError).radioTouched).toBe(true);
        const callsAtCut = bridge.calls.length;
        await closeAll(pipe, bridge);

        // Power on with no keys: the loader restarts from its record and talks first at the app rate.
        await bridge.powerOn();
        const resumedAt = Date.now();
        pipe = await openWebSerialPipe(bridge.port, 9600, { raiseDtrRts: false });
        const second = createUv5rMiniFirmwareUpdater();
        const ident = await second.identify(pipe, {});
        expect(ident.version).toBe('update in progress');
        expect(ident.notice).toContain('continuing');
        const rec2 = phaseRecorder();
        const result = await second.flash(image, { onProgress: rec2.onProgress });
        const status = await bridge.status();

        report(
          'cut-and-continue',
          {
            cutAfter,
            cutError: (cutError as FirmwareFlashError).position,
            cutPhases: rec1.phases,
            cutWallS: secs(cutWall),
            identNotice: ident.notice,
            end: result.end,
            phases: rec2.phases,
            resumeWallS: secs(Date.now() - resumedAt),
            totalWallS: secs(Date.now() - started),
            reopenMsFirstSession: reopenMs(bridge, 0, callsAtCut),
            reopenMsResumed: reopenMs(bridge, callsAtCut),
          },
          status,
        );

        expect(result.end).toBe('acknowledged');
        expect(status.result).toBe(0);
        expect(status.outside).toEqual([]);
        expect(status.matches_prediction).toBe(true);
      } finally {
        await closeAll(pipe, bridge);
        await bridge.dispose();
      }
    },
    15 * 60_000,
  );
});
