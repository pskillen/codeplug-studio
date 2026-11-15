import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import type { RadioBackupRegionV1 } from '@integrations/radio-io/backup/types.ts';
import {
  buildDm32CalibrationBackupSidecars,
  dm32FactorySectorRegion,
} from '@integrations/radio-io/radios/dm32uv/calibrationDecode.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CONNECTION,
  DM32_VFRAME,
} from '@integrations/radio-io/radios/dm32uv/constants.ts';
import {
  captureDm32DebugPipe,
  type Dm32DebugCapture,
} from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';
import {
  DM32_DEBUG_CAPTURE_PATH,
  DM32_DEBUG_VFRAMES_PATH,
  dm32DebugHex,
  type Dm32DebugCaptureJson,
  type Dm32DebugVFrameJson,
} from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  requestCapacitorSerialPort,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

const json = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

/** Pack a guarded capture into a partial standard radio-backup archive, then reopen it. */
export async function archiveDm32Capture(capture: Dm32DebugCapture): Promise<DebugArchive> {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  const blocks = [...capture.blocks].sort(([a], [b]) => a - b);
  // One entry per contiguous run of captured blocks; holes stay holes.
  for (let i = 0; i < blocks.length;) {
    const start = blocks[i]![0];
    const parts: Uint8Array[] = [];
    let end = start;
    while (i < blocks.length && blocks[i]![0] === end) {
      parts.push(blocks[i]![1]);
      end += blocks[i++]![1].length;
    }
    const data = new Uint8Array(end - start);
    parts.reduce((offset, part) => (data.set(part, offset), offset + part.length), 0);
    const id = `sparse-${start.toString(16)}`;
    regions.push({
      id,
      label: 'Sparse configuration',
      address: start,
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
  }
  const kept = capture.factory.status === 'kept' ? capture.factory.bytes : null;
  if (kept) {
    const factory = dm32FactorySectorRegion(kept);
    regions.push(factory.region);
    bytes[factory.region.id] = factory.bytes;
  }
  const efuse = capture.vframes.find((v) => v.id === DM32_VFRAME.EFUSE_IDENTITY);
  const calibration = await buildDm32CalibrationBackupSidecars({
    blocks: blocks.map(([address, data]) => ({ address, data })),
    window: capture.window,
    efuse: efuse?.status === 'ok' ? efuse.payload : null,
    factorySector: kept,
    factoryNotKeptReason: capture.factory.status === 'not-kept' ? capture.factory.reason : null,
  });
  const vframes: Dm32DebugVFrameJson[] = capture.vframes.map((v) =>
    v.status === 'ok'
      ? { id: v.id, status: 'ok', payloadHex: dm32DebugHex(v.payload) }
      : { id: v.id, status: 'failed', reason: v.reason },
  );
  const record: Dm32DebugCaptureJson = {
    modelString: capture.modelString,
    v0a: capture.rawRange,
    window: capture.window,
    discovered: capture.discovered.map((b) => ({ address: b.address, tag: b.metadata })),
    channelCount: capture.channelCount,
    extraReadTags: [],
    factory:
      capture.factory.status === 'kept'
        ? { status: 'kept' }
        : { status: 'not-kept', reason: capture.factory.reason },
  };
  const zip = packRadioBackupZip(
    {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: capture.capturedAt,
      capturedVia: 'web-serial',
      app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
      radioModelId: 'DM-32UV',
      descriptorLabel: 'DM-32UV debug capture',
      coverage: 'partial',
      addressBase: capture.window.start,
      imageByteLength: capture.window.end + DM32_BLOCK_SIZE - capture.window.start,
      regions,
    },
    bytes,
    {
      ...calibration,
      [DM32_DEBUG_VFRAMES_PATH]: json(vframes),
      [DM32_DEBUG_CAPTURE_PATH]: json(record),
    },
  );
  return { ...openDebugArchive(zip, 'DM-32UV'), source: 'live-read' };
}

export async function captureDm32(opts?: {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<DebugArchive> {
  const native = isCapacitorSerialSupported();
  const pipe = native
    ? await openCapacitorSerialPipe(await requestCapacitorSerialPort(), DM32_CONNECTION.BAUD_RATE)
    : await openWebSerialPipe(await requestWebSerialPort(true), DM32_CONNECTION.BAUD_RATE);
  return archiveDm32Capture(await captureDm32DebugPipe(pipe, opts));
}
