import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { readRt95Calibration } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { backupLiveRadioSession } from '@app/services/radioBackupRead.ts';
import { openWithBaudFallback } from '@app/services/serialBaudFallback.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { guardRt95ClonePipe } from '@integrations/radio-io/radios/rt95/transportGuard.ts';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  requestCapacitorSerialPort,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { BytePipe, ProgressFn } from '@integrations/radio-io/types.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

/** Reuses the build backup's download, packing and hydration path. */
export async function captureRt95Pipe(
  pipe: BytePipe,
  opts?: { signal?: AbortSignal; onProgress?: ProgressFn },
): Promise<DebugArchive> {
  const safePipe = guardRt95ClonePipe(pipe);
  const radio = RT95_DESCRIPTOR.protocolFactory();
  try {
    const ident = await radio.connect(safePipe, { handshake: 'read', signal: opts?.signal });
    const backup = await backupLiveRadioSession(
      createRadioSession({ descriptor: RT95_DESCRIPTOR, pipe: safePipe, radio }),
      { ...opts, download: false },
    );
    const original = openDebugArchive(backup.zipBytes, RT95_DESCRIPTOR.modelIds[0]!);
    const calibration = await readRt95Calibration(radio, opts?.signal);
    const manifest = {
      ...original.manifest,
      coverage: 'partial' as const,
      regions: [
        ...original.manifest.regions,
        {
          id: 'rt95-calibration',
          label: 'RT95 calibration and production record',
          address: 0x3b00,
          byteLength: calibration.length,
          path: 'regions/rt95-calibration.bin',
          restoreRole: 'inspect-only' as const,
        },
      ],
    };
    const zip = packRadioBackupZip(
      manifest,
      { ...original.regions, 'rt95-calibration': calibration },
      { ...original.sidecars, 'debug/ident.bin': ident.raw },
    );
    return {
      ...openDebugArchive(zip, RT95_DESCRIPTOR.modelIds[0]!),
      source: 'live-read',
    };
  } finally {
    try {
      await radio.disconnect();
    } finally {
      await safePipe.close();
    }
  }
}

export async function captureRt95(opts?: {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<DebugArchive> {
  const native = isCapacitorSerialSupported();
  const device = native ? await requestCapacitorSerialPort() : null;
  const port = native ? null : await requestWebSerialPort(true);
  const { result } = await openWithBaudFallback({
    bauds: [RT95_DESCRIPTOR.baudRate],
    open: async (baud) =>
      device ? openCapacitorSerialPipe(device, baud) : openWebSerialPipe(port!, baud),
    handshake: (pipe) => captureRt95Pipe(pipe, opts),
  });
  return result;
}
