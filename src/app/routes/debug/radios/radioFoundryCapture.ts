import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  buildRadioFoundryDebugArchiveParts,
  captureRadioFoundryDebugPipe,
} from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import { RADIOFOUNDRY_DEBUG_AREA2_OPTION } from '@integrations/radio-io/radios/radiofoundry/debugText.ts';
import { radioFoundryCableBoardForModelId } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  requestCapacitorSerialPort,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import type { RadioDebugCapture, RadioDebugCaptureOptions } from './descriptors.ts';

/** A capture function for one RadioFoundry board: opens serial, reads, returns the archive. */
export function captureRadioFoundry(modelId: string): RadioDebugCapture {
  return async (opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
    options?: RadioDebugCaptureOptions;
  }): Promise<DebugArchive> => {
    const board = radioFoundryCableBoardForModelId(modelId);
    if (!board) throw new Error(`No RadioFoundry board for ${modelId}.`);
    const native = isCapacitorSerialSupported();
    const pipe = native
      ? await openCapacitorSerialPipe(await requestCapacitorSerialPort(), board.baudRate)
      : await openWebSerialPipe(await requestWebSerialPort(true), board.baudRate);
    const capture = await captureRadioFoundryDebugPipe(pipe, board, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      capturedVia: native ? 'android-usb-serial' : 'web-serial',
      includeArea2: opts?.options?.[RADIOFOUNDRY_DEBUG_AREA2_OPTION] === true,
    });
    const { manifest, regions, sidecars } = buildRadioFoundryDebugArchiveParts(capture);
    const zip = packRadioBackupZip(manifest, regions, sidecars);
    return { ...openDebugArchive(zip, modelId), source: 'live-read' };
  };
}