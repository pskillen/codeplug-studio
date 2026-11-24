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
import type { DebugOpenPort } from '@integrations/radio-io/debugHandoff.ts';
import type { RadioDebugCapture, RadioDebugCaptureOptions } from './descriptors.ts';

/** A capture function for one RadioFoundry board: opens serial, reads, returns the archive. */
export function captureRadioFoundry(modelId: string): RadioDebugCapture {
  return async (opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
    options?: RadioDebugCaptureOptions;
    port?: DebugOpenPort;
    keepPortOnWrongFirmware?: boolean;
  }): Promise<DebugArchive> => {
    const board = radioFoundryCableBoardForModelId(modelId);
    if (!board) throw new Error(`No RadioFoundry board for ${modelId}.`);
    let pipe;
    let capturedVia: 'web-serial' | 'android-usb-serial';
    if (opts?.port) {
      if (opts.port.baudRate !== board.baudRate) {
        await opts.port.close();
        throw new Error(
          `The open port runs at ${opts.port.baudRate} baud; this radio needs ${board.baudRate}. Read radio again.`,
        );
      }
      pipe = opts.port.pipe;
      capturedVia = opts.port.capturedVia;
    } else {
      const native = isCapacitorSerialSupported();
      pipe = native
        ? await openCapacitorSerialPipe(await requestCapacitorSerialPort(), board.baudRate)
        : await openWebSerialPipe(await requestWebSerialPort(true), board.baudRate);
      capturedVia = native ? 'android-usb-serial' : 'web-serial';
    }
    const capture = await captureRadioFoundryDebugPipe(pipe, board, {
      signal: opts?.signal,
      onProgress: opts?.onProgress,
      capturedVia,
      includeArea2: opts?.options?.[RADIOFOUNDRY_DEBUG_AREA2_OPTION] === true,
      keepPortOnOpenGd77: opts?.keepPortOnWrongFirmware === true,
    });
    const { manifest, regions, sidecars } = buildRadioFoundryDebugArchiveParts(capture);
    const zip = packRadioBackupZip(manifest, regions, sidecars);
    return { ...openDebugArchive(zip, modelId), source: 'live-read' };
  };
}
