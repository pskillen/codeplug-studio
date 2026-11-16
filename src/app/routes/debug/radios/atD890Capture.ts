import {
  packRadioBackupZip,
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
} from '@integrations/radio-io/backup/index.ts';
import type { RadioBackupRegionV1 } from '@integrations/radio-io/backup/types.ts';
import {
  AT_D890_CONNECTION,
  AT_D890_MAP_SIZE,
} from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  captureAtD890DebugPipe,
  type AtD890DebugCapture,
} from '@integrations/radio-io/radios/at-d890uv/debugCapture.ts';
import {
  isCapacitorSerialSupported,
  openCapacitorSerialPipe,
  openWebSerialPipe,
  requestCapacitorSerialPort,
  requestWebSerialPort,
} from '@integrations/radio-io/transport/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { AT_D890_PROVENANCE_PATH, type AtD890ReadRange } from './atD890Provenance.ts';

export function archiveAtD890Capture(capture: AtD890DebugCapture): DebugArchive {
  const regions: RadioBackupRegionV1[] = [];
  const bytes: Record<string, Uint8Array> = {};
  const ranges: AtD890ReadRange[] = [];
  const add = (id: string, label: string, address: number, data: Uint8Array) => {
    regions.push({
      id,
      label,
      address,
      byteLength: data.length,
      path: `regions/${id}.bin`,
      restoreRole: 'inspect-only',
    });
    bytes[id] = data;
    const unit = capture.vital.units.find((u) => `vital-${u.def.id}` === id);
    ranges.push({
      regionId: id,
      address,
      byteLength: data.length,
      kind: unit ? 'vital' : 'sparse',
      requestedUnit: unit?.def.id ?? null,
      respondingUnit: null,
      bothReadsMatched: unit ? capture.vital.bothReadsMatched : null,
    });
  };
  const blocks = [...capture.cache.blocks].sort(([a], [b]) => a - b);
  for (let i = 0; i < blocks.length;) {
    const [start] = blocks[i]!;
    const parts: Uint8Array[] = [];
    let end = start;
    while (i < blocks.length && blocks[i]![0] === end) {
      const part = blocks[i++]![1];
      parts.push(part);
      end += part.length;
    }
    const data = new Uint8Array(end - start);
    let offset = 0;
    for (const part of parts) {
      data.set(part, offset);
      offset += part.length;
    }
    add(`sparse-${start.toString(16)}`, 'Sparse configuration', start, data);
  }
  for (const unit of capture.vital.units)
    add(`vital-${unit.def.id}`, unit.def.label, unit.def.address, unit.bytes);
  const zip = packRadioBackupZip(
    {
      format: RADIO_BACKUP_FORMAT,
      version: RADIO_BACKUP_VERSION,
      capturedAt: capture.capturedAt,
      capturedVia: 'web-serial',
      app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
      radioModelId: 'AT-D890UV',
      descriptorLabel: 'AT-D890UV debug capture',
      coverage: 'partial',
      imageByteLength: AT_D890_MAP_SIZE,
      regions,
    },
    bytes,
    {
      'debug/ident.bin': capture.ident.raw,
      [AT_D890_PROVENANCE_PATH]: new TextEncoder().encode(JSON.stringify({ version: 1, ranges })),
      'debug/vital.json': new TextEncoder().encode(
        JSON.stringify({
          bothReadsMatched: capture.vital.bothReadsMatched,
          units: capture.vital.units.map((u) => u.def),
        }),
      ),
    },
  );
  return { ...openDebugArchive(zip, 'AT-D890UV'), source: 'live-read' };
}

export async function captureAtD890(opts?: {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}): Promise<DebugArchive> {
  const native = isCapacitorSerialSupported();
  const pipe = native
    ? await openCapacitorSerialPipe(
        await requestCapacitorSerialPort(),
        AT_D890_CONNECTION.BAUD_RATE,
      )
    : await openWebSerialPipe(await requestWebSerialPort(true), AT_D890_CONNECTION.BAUD_RATE);
  return archiveAtD890Capture(await captureAtD890DebugPipe(pipe, opts));
}
