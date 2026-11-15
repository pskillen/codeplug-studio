import {
  grantUv5rMiniDebugPort,
  runUv5rMiniDebugFullRead,
} from '@app/services/uv5rMiniDebugRead.ts';
import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import {
  UV5R_MINI_FULL_READ_SIZE,
  type Uv5rMiniFullRead,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { isCapacitorSerialSupported } from '@integrations/radio-io/transport/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

/** Package the decoded clone address space and preserve the wire data and handshake replies. */
export function archiveUv5rMiniRead(
  read: Uv5rMiniFullRead,
  capturedAt = new Date().toISOString(),
  capturedVia: 'web-serial' | 'android-usb-serial' = 'web-serial',
): DebugArchive {
  if (
    read.raw.length !== UV5R_MINI_FULL_READ_SIZE ||
    read.decoded.length !== UV5R_MINI_FULL_READ_SIZE
  )
    throw new Error('Incomplete Mini clone read.');
  const region = {
    id: 'clone',
    label: 'Decoded clone address space',
    address: 0,
    byteLength: UV5R_MINI_FULL_READ_SIZE,
    path: 'regions/clone.bin',
    restoreRole: 'inspect-only' as const,
  };
  const zip = packRadioBackupZip(
    {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt,
      capturedVia,
      app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
      radioModelId: 'UV-5R Mini',
      descriptorLabel: 'UV-5R Mini debug capture',
      coverage: 'full-clone',
      imageByteLength: UV5R_MINI_FULL_READ_SIZE,
      regions: [region],
    },
    { clone: read.decoded },
    { 'debug/wire.bin': read.raw, 'debug/f.bin': read.ident.f, 'debug/m.bin': read.ident.m },
  );
  return { ...openDebugArchive(zip, 'UV-5R Mini'), source: 'live-read' };
}

export async function captureUv5rMini(opts?: {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<DebugArchive> {
  const port = await grantUv5rMiniDebugPort();
  const read = await runUv5rMiniDebugFullRead({ port, ...opts });
  const at = new Date();
  const archive = archiveUv5rMiniRead(
    read,
    at.toISOString(),
    isCapacitorSerialSupported() ? 'android-usb-serial' : 'web-serial',
  );
  uv5rMiniDebugReadStore.add(read, at);
  return archive;
}
