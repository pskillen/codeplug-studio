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
    patchName: 'baofeng-dm32-firmware',
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
    radioId: 'baofeng-dm32uv',
    tag: '1.0.0-rc.3',
    patchName: 'baofeng-dm32-firmware',
    channel: 'rc',
    patchFile: 'dm32-fw-1.0.0-rc.3.patch.json',
    patchSha256: '4946fe57a7bb5a894f34e573591724a074b66f5316d056104620eca1faa593d3',
    stockVersion: 'v1.01.048',
    publishedOn: '2026-10-20',
    summary:
      'The 1.0.0 release candidate: zone scan on channels without a scan list, a quick menu with light mode, position-report retry, a GPS padding fix and menu text fixes.',
    verifyHint:
      'Press Scan on a channel with no scan list: a zone scan should start. Device information still reads DM32.01.L01.048; that is expected.',
    resultSha256: { bin: '15c318dd0bcca64c66844b689fe9f4cca50dc55e90b883f8807b833c87085dd8' },
    loadBytes: () => import('./baofeng-dm32uv/1.0.0-rc.3.patch.json?raw').then(enc),
    loadNotes: () =>
      import('./baofeng-dm32uv/1.0.0-rc.3.release-notes.md?raw').then((m) => m.default),
  },
  {
    radioId: 'baofeng-dm32uv',
    tag: '1.1.0',
    patchName: 'baofeng-dm32-firmware',
    channel: 'final',
    patchFile: 'dm32-fw-1.1.0.patch.json',
    patchSha256: 'e4ea52a8717c0cad0fed72d78fe868ef37227b2e0a5b231b53d553c3e0408000',
    stockVersion: 'v1.01.048',
    publishedOn: '2026-10-22',
    summary:
      'Talk-group keys that step through the RX group list, the PTT contact on screen, a star-key timeslot swap with a TS1/TS2 badge, a timeslot from a talk-group name suffix, and the mod version in Device Info.',
    verifyHint: 'Settings > Device Info > Versions shows "mm9pdy-1.1.0" under DM32.01.L01.048.',
    resultSha256: { bin: 'd77cdb00dbfd0e72a786c2a54cdb9fa07bceaf530bf8e953f2ed96be37a96be5' },
    loadBytes: () => import('./baofeng-dm32uv/1.1.0.patch.json?raw').then(enc),
    loadNotes: () => import('./baofeng-dm32uv/1.1.0.release-notes.md?raw').then((m) => m.default),
  },
  {
    radioId: 'baofeng-dm32uv',
    tag: '1.2.0-rc.1',
    patchName: 'baofeng-dm32-firmware',
    channel: 'rc',
    patchFile: 'dm32-fw-1.2.0-rc.1.patch.json',
    patchSha256: '6eea12ecfc9a9422917340d9bd31d16a907a6aac459bb2f4d14a47ebc3a52135',
    stockVersion: 'v1.01.048',
    publishedOn: '2026-10-23',
    summary:
      "A 1.2.0 release candidate: a timeslot per RX group list member, quick-menu RX match and TS filter rows, and the distance to the channel's site from positions Codeplug Studio writes. Emulator-checked only.",
    verifyHint:
      'Settings > Device Info > Versions shows "mm9pdy-1.2.0-rc.1" under DM32.01.L01.048.',
    resultSha256: { bin: '96be3b3374d10a8339fa0d1d66c578e3c710ca77bf20058f3261e9ba9730eb93' },
    loadBytes: () => import('./baofeng-dm32uv/1.2.0-rc.1.patch.json?raw').then(enc),
    loadNotes: () =>
      import('./baofeng-dm32uv/1.2.0-rc.1.release-notes.md?raw').then((m) => m.default),
  },
  {
    radioId: 'anytone-at-d890uv',
    tag: '1.0.0',
    patchName: 'anytone-d890-firmware',
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
  {
    radioId: 'anytone-at-d890uv',
    tag: '1.1.0-rc.1',
    patchName: 'anytone-d890-firmware',
    channel: 'rc',
    patchFile: 'd890-fw-1.1.0-rc.1.patch.json',
    patchSha256: '64e67c9814167df0de98253adf25e4bed63d32adb69e6a6cb0eb6be79b7776f7',
    stockVersion: 'V1.05 (20260521)',
    publishedOn: '2026-10-22',
    summary:
      'A 1.1.0 release candidate: a Mod Ver item in Device Info, a channel with no contact starting on its first RX-group talk group, and TG Next / TG Previous during a call.',
    verifyHint: 'After the radio restarts, Device Info > Mod Ver shows "mm9pdy-1.1.0-rc.1".',
    resultSha256: {
      cdd: '713084e05671f22e58fb4d496422dd071e97bdcc7e34b78c5e99660a63aab2c9',
      cdi: '7168e9536640da2bc9192bfff2c14929b7287d072d2718eedcc99a6c982ca563',
      spi: '06914a208c16e8f72d1956c99771720c95333d05d1f57908f284bb02bc658f1f',
    },
    loadBytes: () => import('./anytone-at-d890uv/1.1.0-rc.1.patch.json?raw').then(enc),
    loadNotes: () =>
      import('./anytone-at-d890uv/1.1.0-rc.1.release-notes.md?raw').then((m) => m.default),
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
