/**
 * Bundled firmware release index. Each row lazy-loads the exact published patch text with Vite's `?raw` suffix, so
 * the runtime hashes the same bytes the firmware project published. Adding a release:
 * docs/features/firmware-flashing/adding-a-release.md. Never vendor firmware: release patches only.
 */
import type { FirmwareRadioId, KnownPatchedResult } from '../types.ts';
import type { BundledFirmwareRelease } from './types.ts';

const enc = (m: { default: string }) => new TextEncoder().encode(m.default);

export const BUNDLED_FIRMWARE_RELEASES: readonly BundledFirmwareRelease[] = [
  {
    radioId: 'baofeng-dm32uv',
    tag: '1.0.0',
    channel: 'final',
    patchFile: 'dm32-fw-1.0.0.patch.json',
    patchSha256: 'fb14da26d8248011d50b89fc8286c67fcbcabeb3b43ebf3d184afd7bc474bf9f',
    stockVersion: 'v1.01.048',
    publishedOn: '2026-10-20',
    summary:
      'Zone scan on channels without a scan list, a quick menu with light mode, position-report retry, a GPS padding fix and menu text fixes.',
    verifyHint:
      'Press Scan on a channel with no scan list: a zone scan should start. Device information still reads DM32.01.L01.048; that is expected.',
    resultSha256: { bin: '342bd5aceb5021508d31a1fc58d1cb12e41a1840ebe1b1c18c86f3cd23e5739a' },
    loadBytes: () => import('./baofeng-dm32uv/1.0.0.patch.json?raw').then(enc),
    loadNotes: () => import('./baofeng-dm32uv/1.0.0.release-notes.md?raw').then((m) => m.default),
  },
  {
    radioId: 'anytone-at-d890uv',
    tag: '1.0.0',
    channel: 'final',
    patchFile: 'd890-fw-1.0.0.patch.json',
    patchSha256: 'bd9e32812a89d91fdb548f6dddbea81f7de65c3d8c096e87ed20c82487f68b1f',
    stockVersion: 'V1.05 (20260521)',
    publishedOn: '2026-10-20',
    summary:
      'Talk-group keys, a star-key timeslot toggle, a quick filters menu, whole-zone scan, and the release name on the power-on screen.',
    verifyHint: 'After the radio restarts, Device Info > Version shows "1.0.0".',
    resultSha256: {
      cdd: '934ed27c51ef38a125c88f418deae90fb8d131969046c620f6c164913f8ba19b',
      cdi: 'd74cb1e9f3dfd49eb8cc2b30f8640f335508303f35f91621deccbe0ffe7cb56d',
      spi: 'd00aebd3a1a6b20ff1a5ebcf38662a63cbc8cbe4f90277c7f33083b8a064523d',
    },
    loadBytes: () => import('./anytone-at-d890uv/1.0.0.patch.json?raw').then(enc),
    loadNotes: () =>
      import('./anytone-at-d890uv/1.0.0.release-notes.md?raw').then((m) => m.default),
  },
];

/** Result hashes of every bundled release for a radio, so stock resolution can say "this is already patched". */
export function listKnownPatchedResults(
  radioId: FirmwareRadioId,
  rows: readonly BundledFirmwareRelease[] = BUNDLED_FIRMWARE_RELEASES,
): readonly KnownPatchedResult[] {
  return rows
    .filter((r) => r.radioId === radioId)
    .map((r) => ({ radioId: r.radioId, label: `release ${r.tag}`, sha256: r.resultSha256 }));
}
