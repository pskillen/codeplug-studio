import type { DebugIdentityInput, DebugIdentityRows } from '../../debugView/index.ts';
import { atD890DebugIdentity } from './debugCoverage.ts';

/** Caption sentence under the D890 identity grid. */
export const AT_D890_IDENTITY_NOTE =
  'Ident and LocalInfo values come from captured bytes; V100 is protocol evidence, not a running firmware version. Missing markers do not prove stock firmware.';

/** Backup-tab notice about what the D890 read sends and how to recover. */
export const AT_D890_READ_NOTICE = {
  title: 'Read-only capture and recovery',
  text: 'The radio is read at fixed 16-byte blocks; vital units are read twice and can take time. If a read fails or is cancelled, power-cycle the radio before continuing. A fresh LocalInfo check precedes END, but the check and END are not atomic. Firmware may divert vital reads.',
};

/** Overview rows for the AT-D890UV: the captured ident and LocalInfo only. */
export function atD890IdentityRows({ archive, connection }: DebugIdentityInput): DebugIdentityRows {
  const identity = archive
    ? atD890DebugIdentity(
        archive.sidecars['debug/ident.bin'],
        archive.manifest.regions,
        archive.regions,
      )
    : undefined;
  return [
    ['Model · captured ident', identity?.ident?.model ?? 'Unknown'],
    [
      'Band code · captured ident',
      identity?.ident
        ? `0x${identity.ident.bandCode.toString(16).toUpperCase().padStart(2, '0')}`
        : 'Unknown',
    ],
    ['Ident version · protocol', identity?.ident?.version ?? 'Unknown'],
    ['Serial · captured LocalInfo', identity?.serial ?? 'Unknown'],
    ['Running firmware', 'Unknown'],
    ['Firmware mod', 'Unknown'],
    [
      'Evidence',
      identity?.ident || identity?.serial ? 'Captured radio bytes' : 'No radio identity observed',
    ],
    ['Connection', connection],
  ];
}
