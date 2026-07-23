/**
 * Web Serial / binary clone hydration for {@link FormatBuild.cpsWireHydration}.
 *
 * Parallel to NeonPlug file donor bags (`formatId: 'neonplug'`): persist the
 * full (or sparse) clone image so unmodelled registers survive write-back.
 * Modelled channels still come from assemble() — this bag is not wire-stash
 * for library entities.
 *
 * Opaque at the YAML boundary (native-yaml already passes unknown formatIds).
 */

import type { CpsWireHydrationBase } from './cpsWireHydration.ts';

export const RADIO_CLONE_HYDRATION_FORMAT_ID = 'radio-clone' as const;

export interface RadioCloneRetain {
  /** Registry model id (e.g. UV5R-Mini). */
  radioModelId: string;
  /** How the image was captured. */
  capturedVia: 'web-serial' | 'ble' | 'import';
  /** Packed clone image as base64 (Uint8Array). */
  imageBase64: string;
  /** Optional firmware string parsed from the image. */
  firmware?: string;
  /** Image byte length (for quick UI without decoding). */
  imageByteLength: number;
}

export interface RadioCloneHydrationBag extends CpsWireHydrationBase {
  formatId: typeof RADIO_CLONE_HYDRATION_FORMAT_ID;
  retain: RadioCloneRetain;
}

export function isRadioCloneHydrationBag(value: unknown): value is RadioCloneHydrationBag {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.formatId !== RADIO_CLONE_HYDRATION_FORMAT_ID) return false;
  const retain = record.retain;
  if (retain == null || typeof retain !== 'object' || Array.isArray(retain)) return false;
  const r = retain as Record<string, unknown>;
  return (
    typeof r.radioModelId === 'string' &&
    typeof r.imageBase64 === 'string' &&
    typeof r.imageByteLength === 'number' &&
    (r.capturedVia === 'web-serial' || r.capturedVia === 'ble' || r.capturedVia === 'import')
  );
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function createRadioCloneHydrationBag(input: {
  radioModelId: string;
  imageBytes: Uint8Array;
  firmware?: string;
  capturedVia?: RadioCloneRetain['capturedVia'];
  sourceFileName?: string;
  capturedAt?: string;
}): RadioCloneHydrationBag {
  return {
    formatId: RADIO_CLONE_HYDRATION_FORMAT_ID,
    sourceFileName: input.sourceFileName,
    capturedAt: input.capturedAt ?? new Date().toISOString(),
    retain: {
      radioModelId: input.radioModelId,
      capturedVia: input.capturedVia ?? 'web-serial',
      imageBase64: bytesToBase64(input.imageBytes),
      imageByteLength: input.imageBytes.length,
      ...(input.firmware !== undefined ? { firmware: input.firmware } : {}),
    },
  };
}

export function radioCloneImageBytes(bag: RadioCloneHydrationBag): Uint8Array {
  return base64ToBytes(bag.retain.imageBase64);
}
