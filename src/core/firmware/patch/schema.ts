/**
 * Shared structural checks for untrusted patch JSON. Every failure is `patch-malformed`.
 */
import { FirmwareError } from '../errors.ts';
import { hexToBytes } from '../hex.ts';
import type { FirmwarePatchHashes } from './types.ts';

const SHA256_RE = /^[0-9a-fA-F]{64}$/;

export function malformed(detail: string): FirmwareError {
  return new FirmwareError('patch-malformed', `The patch file is malformed: ${detail}.`);
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function requireRecord(v: unknown, field: string): Record<string, unknown> {
  if (!isRecord(v)) throw malformed(`"${field}" must be an object`);
  return v;
}

export function requireArray(v: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(v)) throw malformed(`"${field}" must be a list`);
  return v;
}

/** A non-negative safe integer. */
export function requireUint(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) {
    throw malformed(`"${field}" must be a whole number of zero or more`);
  }
  return v;
}

export function requireString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) throw malformed(`"${field}" must be text`);
  return v;
}

/** 64 hex characters, normalised to lowercase. */
export function requireSha256(v: unknown, field: string): string {
  if (typeof v !== 'string' || !SHA256_RE.test(v)) {
    throw malformed(`"${field}" must be a SHA-256 hash`);
  }
  return v.toLowerCase();
}

export function requireHex(v: unknown, field: string): Uint8Array {
  if (typeof v !== 'string') throw malformed(`"${field}" must be hex text`);
  try {
    return hexToBytes(v);
  } catch {
    throw malformed(`"${field}" is not valid hex`);
  }
}

export function requireHashes(v: unknown, field: string): FirmwarePatchHashes {
  const r = requireRecord(v, field);
  return {
    sha256: requireSha256(r.sha256, `${field}.sha256`),
    size: requireUint(r.size, `${field}.size`),
  };
}
