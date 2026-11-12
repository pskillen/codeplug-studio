/**
 * RT95 safety backup service (#1617): live read through the connected protocol, zip on disk, the per-radio
 * "saved" record, and open-for-record of a file the operator already has. Read-only; no restore.
 */

import { downloadZip } from '@integrations/download/browserDownload.ts';
import {
  recordSafetyBackup,
  type RadioSafetyBackupRecord,
} from '@integrations/persistence/radioSafetyBackupRecords.ts';
import { RadioProtocolError } from '@integrations/radio-io/kit/errors.ts';
import { Rt95Protocol } from '@integrations/radio-io/radios/rt95/protocol.ts';
import {
  normaliseRadioSerial,
  parseRt95SafetyZip,
  RT95_SAFETY_RECORD_FAMILY,
  rt95SafetyBackupRadioKey,
  type ParsedRt95SafetyZip,
} from '@integrations/radio-io/radios/rt95/safetyBackup/files.ts';
import {
  readRt95SafetyRegion,
  type Rt95SafetyRegion,
} from '@integrations/radio-io/radios/rt95/safetyBackup/reader.ts';
import {
  packRt95SafetyResult,
  rt95SafetyToolName,
  type Rt95SafetyBackupResult,
} from '@integrations/radio-io/radios/rt95/safetyBackup/runner.ts';
import type { ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';

export type { Rt95SafetyBackupResult };

/**
 * Read the region twice, pack it, and offer the download (`download: false` packs only). The session's
 * radio must be a connected {@link Rt95Protocol}; the caller releases the session (which sends END).
 */
export async function backupRt95Safety(
  session: RadioSession,
  opts: {
    region: Rt95SafetyRegion;
    /** Typed by the operator from the radio's label. */
    serial: string;
    onProgress?: ProgressFn;
    signal?: AbortSignal;
    download?: boolean;
  },
): Promise<Rt95SafetyBackupResult> {
  const radio = session.radio;
  if (!(radio instanceof Rt95Protocol)) {
    throw new RadioProtocolError('The safety backup is only available for the RT95.');
  }
  if (!normaliseRadioSerial(opts.serial)) {
    throw new RadioProtocolError("Type the radio's serial number first (it is on the label).");
  }
  const ident = radio.getConnectIdent();
  if (!ident) {
    throw new RadioProtocolError('The radio ident was not read; reconnect and try again.');
  }
  const { bytes, rereads } = await readRt95SafetyRegion(
    async (addr) => {
      const blocks = await radio.readBlocks([addr], { signal: opts.signal });
      const block = blocks.get(addr);
      if (!block) throw new RadioProtocolError(`No data for block 0x${addr.toString(16)}.`);
      return block;
    },
    { region: opts.region, signal: opts.signal, onProgress: opts.onProgress },
  );
  const result = await packRt95SafetyResult({
    region: opts.region,
    serial: opts.serial,
    ident,
    bytes,
    rereads,
  });
  if (opts.download !== false) downloadZip(result.zipBytes, result.fileName);
  return result;
}

export function downloadRt95SafetyZip(result: { zipBytes: Uint8Array; fileName: string }): void {
  downloadZip(result.zipBytes, result.fileName);
}

function recordFor(input: {
  radioKey: string;
  region: Rt95SafetyRegion;
  fileName: string;
  sha256: string;
  fingerprint: string;
}): RadioSafetyBackupRecord {
  return {
    family: RT95_SAFETY_RECORD_FAMILY,
    radioKey: input.radioKey,
    region: input.region,
    fileName: input.fileName,
    sha256: input.sha256,
    fingerprint: input.fingerprint,
    savedAt: new Date().toISOString(),
    studioVersion: rt95SafetyToolName(),
  };
}

/** The operator confirmed they saved the downloaded file: write the record. Returns false when storage refused. */
export function recordRt95SafetyBackupSaved(result: Rt95SafetyBackupResult): boolean {
  return recordSafetyBackup(
    recordFor({
      radioKey: result.radioKey,
      region: result.region,
      fileName: result.fileName,
      sha256: result.manifest.sha256,
      fingerprint: result.manifest.fingerprint,
    }),
  );
}

export interface OpenedRt95SafetyFile {
  parsed: ParsedRt95SafetyZip;
  /** The file's own name (the zip). */
  fileName: string;
}

/** Verify a backup zip the operator already has. Throws with an operator-facing message when it is not valid. */
export async function openRt95SafetyBackupFile(
  bytes: Uint8Array,
  fileName: string,
): Promise<OpenedRt95SafetyFile> {
  return { parsed: await parseRt95SafetyZip(bytes), fileName };
}

/**
 * Record a verified file as this radio's safety backup. `serial` is the file's own when it has one, else the
 * one the operator typed. Returns false when there is no serial or storage refused.
 */
export function recordRt95SafetyBackupFile(opened: OpenedRt95SafetyFile, serial?: string): boolean {
  const radioKey = rt95SafetyBackupRadioKey(opened.parsed.serial || serial || '');
  if (!radioKey) return false;
  return recordSafetyBackup(
    recordFor({
      radioKey,
      region: opened.parsed.region,
      fileName: opened.fileName,
      sha256: opened.parsed.manifest.sha256,
      fingerprint: opened.parsed.manifest.fingerprint,
    }),
  );
}
