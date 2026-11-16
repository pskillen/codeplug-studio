import {
  packRadioBackupZip,
  type RadioBackupManifestV1,
} from '@integrations/radio-io/backup/index.ts';
import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';

/** A synthetic RT95 programming-image read; never operator data. */
export function rt95Archive(
  image: Uint8Array = buildSyntheticRt95Image(),
  capturedAt = '2026-01-01T00:00:00Z',
): DebugArchive {
  const manifest: RadioBackupManifestV1 = {
    format: 'codeplug-studio-radio-backup',
    version: 1,
    capturedAt,
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: 'test' },
    radioModelId: RT95_MODEL_ID,
    descriptorLabel: 'test',
    coverage: 'partial',
    imageByteLength: image.length,
    regions: [
      {
        id: 'programming-image',
        label: 'Programming image',
        address: 0,
        byteLength: image.length,
        path: 'regions/programming-image.bin',
        restoreRole: 'inspect-only',
      },
    ],
  };
  return {
    ...openDebugArchive(
      packRadioBackupZip(manifest, { 'programming-image': image }),
      RT95_MODEL_ID,
    ),
    source: 'live-read' as const,
  };
}

/** Where the fifth read differs from the first four: one byte, in the row at 0x0120. */
export const RT95_FIFTH_READ_CHANGED_ADDRESS = 0x0123;

/** Five reads in capture order: A to D identical, E with one changed byte. */
export function rt95FiveReads(): DebugArchive[] {
  const base = buildSyntheticRt95Image();
  return ['A', 'B', 'C', 'D', 'E'].map((letter, i) => {
    const image = base.slice();
    if (letter === 'E') image[RT95_FIFTH_READ_CHANGED_ADDRESS] ^= 0x5a;
    return rt95Archive(image, `2026-01-0${i + 1}T00:00:00Z`);
  });
}
