import type { DebugIdentityInput, DebugIdentityRows } from '../../debugView/index.ts';
import { dm32DebugIdentity, type Dm32VFrameEvidence } from './debugCoverage.ts';

/** Caption sentence under the DM-32UV identity grid. */
export const DM32_IDENTITY_NOTE =
  'Values come from the captured PSEARCH and V-frame replies, as returned. This radio has no readable serial. A location page is persistent data, not proof of running firmware; its absence does not prove stock.';

/** Backup-tab notice about what the DM-32UV read sends and how to recover. */
export const DM32_READ_NOTICE = {
  title: 'Read-only capture and recovery',
  text: "The capture sends only the handshake, two factory-sector reads, the V-frame queries, PROGRAM entry and reads inside the radio's configuration window, one at a time. It reads only the blocks the product Read reads and can take a few minutes. There is no END command on this radio: it leaves PROGRAM mode after about 2 seconds of silence. If a read fails or is cancelled, the session stops at once with no retry; wait a few seconds, or power-cycle the radio if it does not return to normal, before continuing.",
};

const asReturned = (frame: Dm32VFrameEvidence | undefined) =>
  !frame
    ? 'Not observed'
    : frame.failed
      ? `Failed: ${frame.failed}`
      : (frame.text ?? (frame.hex ? `0x${frame.hex.toUpperCase()}` : 'Empty reply'));

/** Overview rows for the DM-32UV: the captured PSEARCH and V-frame replies, as returned. */
export function dm32IdentityRows({ archive, connection }: DebugIdentityInput): DebugIdentityRows {
  const identity = archive
    ? dm32DebugIdentity(archive.sidecars, archive.manifest.regions, archive.regions)
    : undefined;
  return [
    ['Model · captured PSEARCH', identity?.modelString ?? 'Unknown'],
    [
      'Base firmware · V01 (stock base version, unchanged by MM9PDY, so not a mod discriminator)',
      asReturned(identity?.baseFirmware),
    ],
    ['Build date · V03', asReturned(identity?.buildDate)],
    ['DSP version · V04', asReturned(identity?.dspVersion)],
    ['Radio version · V05', asReturned(identity?.radioVersion)],
    ['Codeplug version · V0B', asReturned(identity?.codeplugVersion)],
    ['Serial', 'None observed'],
    [
      'Chip UID (8 bytes) + 4 derived, not a serial · V02',
      identity?.chipUidHex ? `0x${identity.chipUidHex.toUpperCase()}` : 'Not observed',
    ],
    [
      'Persistent data',
      identity?.mm9pdyDataPresent
        ? 'MM9PDY-compatible data present'
        : 'No MM9PDY location page captured',
    ],
    ['Running firmware', 'Unknown'],
    ['Firmware mod', 'Unknown'],
    [
      'Evidence',
      identity?.modelString || identity?.vframes.length
        ? 'Captured radio replies'
        : 'No radio identity observed',
    ],
    ['Connection', connection],
  ];
}
