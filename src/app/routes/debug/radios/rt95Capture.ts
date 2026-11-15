import { MMD1_BASE } from '@integrations/radio-io/radios/rt95/modData/layout.ts';
import { RT95_CALIBRATION_START } from '@core/radios/retevis/rt95/calibration.ts';
import {
  RT95_CALIBRATION_REGION_ID,
  RT95_CALIBRATION_REGION_PATH,
  readRt95Calibration,
  readRt95Mmd1,
  RT95_MMD1_REGION_ID,
  RT95_MMD1_REGION_PATH,
  RT95_GUARD_IDENT_SIDECAR,
  RT95_GUARD_ALIAS_SIDECAR,
  RT95_GUARD_OUTCOME_SIDECAR,
} from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { backupLiveRadioSession } from '@app/services/radioBackupRead.ts';
import { openWithBaudFallback } from '@app/services/serialBaudFallback.ts';
import { Rt95Protocol } from '@integrations/radio-io/radios/rt95/protocol.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { guardRt95ClonePipe } from '@integrations/radio-io/radios/rt95/transportGuard.ts';
import { throwIfAborted } from '@integrations/radio-io/kit/progress.ts';
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
  let capture: DebugArchive;
  try {
    if (!(radio instanceof Rt95Protocol))
      throw new Error('RT95 descriptor returned an unexpected protocol.');
    const ident = await radio.connect(safePipe, { handshake: 'read', signal: opts?.signal });
    const backup = await backupLiveRadioSession(
      createRadioSession({ descriptor: RT95_DESCRIPTOR, pipe: safePipe, radio }),
      { ...opts, download: false },
    );
    const original = openDebugArchive(backup.zipBytes, RT95_DESCRIPTOR.modelIds[0]!);
    const calibration = await readRt95Calibration(radio, opts?.signal);
    const mmd1 = await readRt95Mmd1(radio, opts?.signal);
    const manifest = {
      ...original.manifest,
      coverage: 'partial' as const,
      regions: [
        ...original.manifest.regions,
        {
          id: RT95_CALIBRATION_REGION_ID,
          label: 'RT95 calibration and production record',
          address: RT95_CALIBRATION_START,
          byteLength: calibration.length,
          path: RT95_CALIBRATION_REGION_PATH,
          restoreRole: 'inspect-only' as const,
        },
        ...(mmd1.bytes
          ? [
              {
                id: RT95_MMD1_REGION_ID,
                label: 'RT95 MMD1 data',
                address: MMD1_BASE,
                byteLength: mmd1.bytes.length,
                path: RT95_MMD1_REGION_PATH,
                restoreRole: 'inspect-only' as const,
              },
            ]
          : []),
      ],
    };
    const zip = packRadioBackupZip(
      manifest,
      {
        ...original.regions,
        [RT95_CALIBRATION_REGION_ID]: calibration,
        ...(mmd1.bytes ? { [RT95_MMD1_REGION_ID]: mmd1.bytes } : {}),
      },
      {
        ...original.sidecars,
        'debug/ident.bin': ident.raw,
        [RT95_GUARD_IDENT_SIDECAR]: mmd1.ident,
        [RT95_GUARD_ALIAS_SIDECAR]: mmd1.alias,
        [RT95_GUARD_OUTCOME_SIDECAR]: new TextEncoder().encode(JSON.stringify(mmd1.outcome)),
      },
    );
    capture = {
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
  throwIfAborted(opts?.signal);
  return capture;
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
