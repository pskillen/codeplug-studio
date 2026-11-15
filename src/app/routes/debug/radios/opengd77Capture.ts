import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  buildOpenGd77DebugArchiveParts,
  captureOpenGd77DebugPipe,
  type OpenGd77DebugCapture,
} from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  requestCapacitorSerialPort,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

/** Pack a guarded capture into a partial standard radio-backup archive, then reopen it. */
export async function archiveOpenGd77Capture(capture: OpenGd77DebugCapture): Promise<DebugArchive> {
  const { manifest, regions, sidecars } = buildOpenGd77DebugArchiveParts(capture);
  const zip = packRadioBackupZip(manifest, regions, sidecars);
  return { ...openDebugArchive(zip, capture.modelId), source: 'live-read' };
}

/** A capture function for one OpenGD77 model: opens the serial port, reads, returns the archive. */
export function captureOpenGd77(modelId: string) {
  return async (opts?: {
    signal?: AbortSignal;
    onProgress?: ProgressFn;
  }): Promise<DebugArchive> => {
    const descriptor = getRadioDescriptor(modelId);
    if (!descriptor) throw new Error(`No radio descriptor for ${modelId}.`);
    const native = isCapacitorSerialSupported();
    const pipe = native
      ? await openCapacitorSerialPipe(await requestCapacitorSerialPort(), descriptor.baudRate)
      : await openWebSerialPipe(await requestWebSerialPort(true), descriptor.baudRate);
    const capture = await captureOpenGd77DebugPipe(pipe, descriptor, {
      ...opts,
      capturedVia: native ? 'android-usb-serial' : 'web-serial',
    });
    return archiveOpenGd77Capture(capture);
  };
}
