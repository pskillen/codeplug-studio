/**
 * AT-D890UV vital-data backup service (#1288): live read, zip on disk, and open-for-inspect.
 * Read-only. No restore; the zip is never written to the project.
 */

import {
  atD890MaintenanceUnlocked,
  describeAtD890FrequencyRange,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { downloadZip, isoTimestampForFilename } from '@integrations/download/browserDownload.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';
import { RadioProtocolError } from '@integrations/radio-io/kit/errors.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  settingsRetainPreview,
  type AtD890RetainPreviewRow,
} from '@integrations/radio-io/radios/at-d890uv/retainPreview.ts';
import {
  listAtD890NonFfRanges,
  readAtD890VitalUnits,
  type AtD890NonFfRange,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  buildAtD890VitalManifest,
  packAtD890VitalZip,
  parseAtD890VitalZip,
  type AtD890VitalManifest,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackupZip.ts';

export interface AtD890VitalUnitSummary {
  id: string;
  label: string;
  address: number;
  sha256: string;
  asReturned: boolean;
  identicalTo?: string;
  /** Raw non-FF ranges, offsets within the unit (live marker ignored). */
  nonFfRanges: AtD890NonFfRange[];
  nonFfBytes: number;
}

export interface AtD890VitalSession {
  source: 'live-read' | 'file';
  manifest: AtD890VitalManifest;
  zipBytes: Uint8Array;
  serial: string;
  rangeSummary: string;
  units: AtD890VitalUnitSummary[];
  localInfoRows: AtD890RetainPreviewRow[];
}

export function atD890VitalFileName(manifest: AtD890VitalManifest): string {
  return `d890-vital-${isoTimestampForFilename(new Date(manifest.capturedAt))}.zip`;
}

export function downloadAtD890VitalZip(session: AtD890VitalSession): void {
  downloadZip(session.zipBytes, atD890VitalFileName(session.manifest));
}

function summarise(
  source: AtD890VitalSession['source'],
  manifest: AtD890VitalManifest,
  zipBytes: Uint8Array,
  units: Record<string, Uint8Array>,
): AtD890VitalSession {
  const localInfo = units['local-info']?.subarray(0, D890_MAP.LocalInfoLength) ?? new Uint8Array(0);
  const rangeSummary =
    localInfo.length > 3
      ? describeAtD890FrequencyRange(localInfo[0x03]!, {
          maintenanceUnlocked: atD890MaintenanceUnlocked(localInfo),
        }).summary
      : '';
  return {
    source,
    manifest,
    zipBytes,
    serial: manifest.serial,
    rangeSummary,
    units: manifest.units.map((u) => {
      const ranges = listAtD890NonFfRanges(units[u.id]!);
      return {
        id: u.id,
        label: u.label,
        address: u.address,
        sha256: u.sha256,
        asReturned: u.asReturned,
        ...(u.identicalTo ? { identicalTo: u.identicalTo } : {}),
        nonFfRanges: ranges,
        nonFfBytes: ranges.reduce((n, r) => n + (r.end - r.start), 0),
      };
    }),
    localInfoRows: settingsRetainPreview(localInfo),
  };
}

/**
 * Read the vital set twice, pack it, and offer the download. Throws without producing a file on any mismatch.
 * `download: false` packs without saving (the Danger zone saves both of its files together).
 */
export async function backupAtD890Vital(
  session: RadioSession,
  opts?: { onProgress?: ProgressFn; signal?: AbortSignal; download?: boolean },
): Promise<AtD890VitalSession> {
  const radio = session.radio;
  if (!(radio instanceof AtD890uvProtocol)) {
    throw new RadioProtocolError('Vital data backup is only available for the AT-D890UV.');
  }
  const ident = radio.getIdentRaw();
  if (!ident) {
    throw new RadioProtocolError('The radio ident was not read; reconnect and try again.');
  }
  const result = await readAtD890VitalUnits(
    {
      pipe: session.pipe,
      readBlockSize: radio.getNegotiatedReadBlockSize(),
      abandonProgramMode: () => radio.abandonProgramMode(),
    },
    opts,
  );
  const manifest = await buildAtD890VitalManifest({
    units: result.units,
    ident,
    firmware: radio.getDownloadCache()?.firmware,
    capturedAt: new Date().toISOString(),
    app: { buildEnv: __BUILD_ENV__, buildVersion: __BUILD_VERSION__ },
    radioModelId: session.descriptor.modelIds[0] ?? 'AT-D890UV',
  });
  const unitBytes = Object.fromEntries(result.units.map((u) => [u.def.id, u.bytes]));
  const zipBytes = packAtD890VitalZip(manifest, unitBytes);
  const summary = summarise('live-read', manifest, zipBytes, unitBytes);
  if (opts?.download !== false) downloadAtD890VitalZip(summary);
  return summary;
}

/** Open a saved vital file read-only. */
export async function openAtD890VitalZip(bytes: Uint8Array): Promise<AtD890VitalSession> {
  const parsed = await parseAtD890VitalZip(bytes);
  return summarise('file', parsed.manifest, bytes, parsed.units);
}
