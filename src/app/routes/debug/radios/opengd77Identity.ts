import {
  openGd77DebugIdentity,
  type OpenGd77DebugIdentity,
} from '@integrations/radio-io/radios/opengd77/debugCoverage.ts';
import type { DebugArchive } from './captureArchive.ts';

const hex = (n: number, digits: number) => `0x${n.toString(16).padStart(digits, '0')}`;

function featuresText(identity: Extract<OpenGd77DebugIdentity, { status: 'ok' }>): string {
  const { inverseVideo, dmrIdDatabaseNLocation, voicePromptsLoaded } = identity.featureBits;
  const named = [
    inverseVideo && 'inverted display',
    dmrIdDatabaseNLocation && "DMR ID database in 'n' mode",
    voicePromptsLoaded && 'voice prompts loaded',
  ].filter(Boolean);
  return `${hex(identity.features, 4)} · ${named.length ? named.join(', ') : 'no named bits set'}`;
}

/** Overview rows for an OpenGD77 debug profile. Identity is the captured FirmwareInfo reply only. */
export function openGd77IdentityRows({
  archive,
  connection,
}: {
  archive?: DebugArchive;
  connection: string;
}): readonly (readonly [string, string])[] {
  const identity = archive ? openGd77DebugIdentity(archive.sidecars) : undefined;
  const ok = identity?.status === 'ok' ? identity : undefined;
  const evidence = !archive
    ? 'No radio identity observed'
    : identity?.status === 'invalid'
      ? `Invalid FirmwareInfo: ${identity.reason}`
      : ok
        ? 'Captured FirmwareInfo reply'
        : 'Archive manifest only';
  return [
    [
      'Radio type · FirmwareInfo',
      ok ? `${hex(ok.radioType, 2)} · ${ok.radioTypeLabel}` : 'Unknown',
    ],
    ['Revision · FirmwareInfo (as reported)', ok ? ok.revision || 'Empty' : 'Unknown'],
    ['Build date · FirmwareInfo (as reported)', ok ? ok.buildDate || 'Empty' : 'Unknown'],
    ['Flash ID · FirmwareInfo', ok ? hex(ok.flashId, 4) : 'Unknown'],
    ['Features · FirmwareInfo', ok ? featuresText(ok) : 'Unknown'],
    ['Serial', 'None reported by FirmwareInfo'],
    ['Firmware fork', 'Unknown'],
    ['Firmware mod', 'Unknown'],
    ['Evidence', evidence],
    ['Connection', connection],
  ];
}
