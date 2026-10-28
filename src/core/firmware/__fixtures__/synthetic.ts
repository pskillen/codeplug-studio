/**
 * Test-only synthetic firmware: seeded random bytes and descriptors whose hashes are computed on the fly.
 * Never use real stock bytes or real pins as match targets.
 */
import { sha256Hex } from '../hash.ts';
import type { FirmwareRadioId, StockFirmwareDescriptor } from '../types.ts';

/** Deterministic pseudo-random bytes (mulberry32). */
export function seededBytes(seed: number, length: number): Uint8Array {
  let a = seed >>> 0;
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    out[i] = ((t ^ (t >>> 14)) >>> 0) & 0xff;
  }
  return out;
}

export interface SyntheticMemberSpec {
  readonly role: string;
  readonly fileName: string;
  readonly bytes: Uint8Array;
}

export async function syntheticDescriptor(
  radioId: FirmwareRadioId,
  members: readonly SyntheticMemberSpec[],
  zip: { fileName: string; bytes: Uint8Array },
): Promise<StockFirmwareDescriptor> {
  return {
    radioId,
    label: `Synthetic ${radioId}`,
    version: 'v0.0.1-test',
    stockSources: [
      {
        kind: 'download',
        label: 'Vendor download',
        official: true,
        url: 'https://example.invalid/stock.zip',
        host: 'example.invalid',
      },
    ],
    zip: { fileName: zip.fileName, sha256: await sha256Hex(zip.bytes) },
    members: await Promise.all(
      members.map(async (m) => ({
        role: m.role,
        fileName: m.fileName,
        size: m.bytes.length,
        sha256: await sha256Hex(m.bytes),
      })),
    ),
    patchNames: [`synthetic-${radioId}`],
    bootloaderEntry: { steps: ['Enter update mode.'], indicator: 'LED', warnings: [] },
    stockVerifyHint: 'The radio boots normally.',
  };
}
