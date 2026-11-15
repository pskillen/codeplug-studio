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
    await radio.connect(safePipe, { handshake: 'read', signal: opts?.signal });
    const backup = await backupLiveRadioSession(
      createRadioSession({ descriptor: RT95_DESCRIPTOR, pipe: safePipe, radio }),
      { ...opts, download: false },
    );
    return {
      ...openDebugArchive(backup.zipBytes, RT95_DESCRIPTOR.modelIds[0]!),
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
