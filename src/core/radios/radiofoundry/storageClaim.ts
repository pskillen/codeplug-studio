/**
 * RadioFoundry storage claim: product rules (Danger zone). Vendor-neutral constants and validation;
 * wire commands live under integrations/radio-io/radios/radiofoundry/storageClaim/.
 */

import { strToU8, zipSync } from 'fflate';

/** Layout from STORAGE INFO op 0; kept in core so rules stay vendor-neutral. */
export interface StorageClaimLayout {
  region: 'none' | 'ours' | 'foreign' | 'unknown';
  claimPending: boolean;
  settings: { address: number; size: number };
  journal: { address: number; size: number };
  calibration: { address: number; size: number };
}

export const STORAGE_CLAIM_CHUNK_MAX = 1000;
export const STORAGE_CLAIM_POLL_MS = 500;
export const STORAGE_CLAIM_POLL_WINDOW_MS = 20_000;
export const STORAGE_JOURNAL_SIZE = 0x2000;
export const STORAGE_SETTINGS_SIZE_MAX = 64 * 1024;
export const STORAGE_CALIBRATION_SIZE_MAX = 4 * 1024;

export type StorageClaimRangeKind = 'settings' | 'journal' | 'calibration';

export interface StorageClaimRange {
  kind: StorageClaimRangeKind;
  address: number;
  size: number;
}

export interface StorageClaimManifestFile {
  kind: StorageClaimRangeKind;
  address: number;
  size: number;
  path: string;
  sha256: string;
}

export interface StorageClaimManifest {
  board: string;
  firmwareGit: string;
  storageInfo: StorageClaimLayout;
  token: number;
  tokenHex: string;
  uid0: number;
  uid1: number;
  uid2: number;
  capturedAt: string;
  files: readonly StorageClaimManifestFile[];
}

/** Non-zero INFO ranges as claim backup targets, in settings / journal / calibration order. */
export function storageClaimRangesFromInfo(info: StorageClaimLayout): StorageClaimRange[] {
  const out: StorageClaimRange[] = [];
  if (info.settings.size > 0) {
    out.push({ kind: 'settings', address: info.settings.address, size: info.settings.size });
  }
  if (info.journal.size > 0) {
    out.push({ kind: 'journal', address: info.journal.address, size: info.journal.size });
  }
  if (info.calibration.size > 0) {
    out.push({
      kind: 'calibration',
      address: info.calibration.address,
      size: info.calibration.size,
    });
  }
  return out;
}

export class StorageClaimRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageClaimRulesError';
  }
}

function rangesOverlap(a: StorageClaimRange, b: StorageClaimRange): boolean {
  const aEnd = a.address + a.size;
  const bEnd = b.address + b.size;
  return a.address < bEnd && b.address < aEnd;
}

/** Every sane-range rule from the firmware map. Throws before any READ. */
export function assertSaneStorageClaimRanges(ranges: readonly StorageClaimRange[]): void {
  for (const r of ranges) {
    if (r.kind === 'settings') {
      if (r.size === 0 || r.size % 4096 !== 0 || r.size > STORAGE_SETTINGS_SIZE_MAX) {
        throw new StorageClaimRulesError(
          'Settings storage must be a non-zero multiple of 4 KB and at most 64 KB.',
        );
      }
    } else if (r.kind === 'journal') {
      if (r.size !== STORAGE_JOURNAL_SIZE) {
        throw new StorageClaimRulesError('Journal storage must be exactly 8 KB (0x2000).');
      }
    } else if (r.size === 0 || r.size > STORAGE_CALIBRATION_SIZE_MAX) {
      throw new StorageClaimRulesError('Calibration copy must be non-zero and at most 4 KB.');
    }
  }
  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      if (rangesOverlap(ranges[i]!, ranges[j]!)) {
        throw new StorageClaimRulesError('Storage ranges must not overlap.');
      }
    }
  }
}

export function tokenHex8(token: number): string {
  return (token >>> 0).toString(16).padStart(8, '0').toLowerCase();
}

export function addrHex6(address: number): string {
  return (address >>> 0).toString(16).padStart(6, '0').toLowerCase();
}

/** One `.bin` name as `rfoundry_debug.py storage dump` uses. */
export function storageClaimBinFileName(
  token: number,
  capturedAt: Date,
  kind: StorageClaimRangeKind,
  address: number,
): string {
  const stamp = formatClaimTimestamp(capturedAt);
  return `storage_${tokenHex8(token)}_${stamp}_${kind}_${addrHex6(address)}.bin`;
}

export function storageClaimZipFileName(token: number, capturedAt: Date): string {
  return `storage_${tokenHex8(token)}_${formatClaimTimestamp(capturedAt)}.zip`;
}

function formatClaimTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

/** Read chunks for STORAGE op 1 READ; last chunk may be shorter. */
export function storageClaimReadChunks(size: number): number[] {
  if (size <= 0) return [];
  const chunks: number[] = [];
  let left = size;
  while (left > 0) {
    const n = Math.min(STORAGE_CLAIM_CHUNK_MAX, left);
    chunks.push(n);
    left -= n;
  }
  return chunks;
}

export function packStorageClaimZip(
  manifest: StorageClaimManifest,
  files: Record<string, Uint8Array>,
): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    'manifest.json': strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
  };
  for (const file of manifest.files) {
    const bytes = files[file.path];
    if (!(bytes instanceof Uint8Array) || bytes.byteLength !== file.size) {
      throw new StorageClaimRulesError(`Backup is missing or wrong size for ${file.path}.`);
    }
    entries[file.path] = bytes;
  }
  return zipSync(entries);
}
