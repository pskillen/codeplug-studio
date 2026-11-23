/**
 * Facts about testing, not capability: which channel modes the firmware project has checked on which radio, the
 * firmware build Studio was checked against, and conditions on feature cells. The support matrix derives every
 * state from the catalog; it only reads these to annotate cells. Sources are cited per row.
 */
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { RADIOFOUNDRY_STUDIO_PIN } from '@core/radios/radiofoundry/firmware.ts';
import type {
  SupportColumnId,
  SupportEvidence,
  SupportFirmwareBuild,
  SupportPath,
} from './supportMatrix.ts';

export interface SupportModeFact {
  evidence?: SupportEvidence;
  evidenceSource?: string;
  note?: string;
  /** Restricts the mode to these paths (for a mode one path cannot carry). */
  paths?: readonly SupportPath[];
}

export interface SupportFacts {
  /** Keyed by radio target id, then mode. */
  modes: Readonly<Record<string, Partial<Record<ChannelMode, SupportModeFact>>>>;
  /** Keyed by firmware variant id. */
  firmwareBuilds: Readonly<Record<string, SupportFirmwareBuild>>;
  /** Keyed by firmware variant id, then feature column. */
  featureNotes: Readonly<Record<string, Partial<Record<SupportColumnId, string>>>>;
}

const RF = `RadioFoundry ${RADIOFOUNDRY_STUDIO_PIN.git}`;
const DM1701_ON_AIR =
  'RadioFoundry\u2019s on-air tests on the DM-1701 (firmware 5a13814, 2026-10-10)';

export const SUPPORT_FACTS: SupportFacts = {
  modes: {
    'baofeng-dm32uv-radiofoundry': {
      fm: { evidence: 'bench', evidenceSource: `FM checked on the bench by RadioFoundry (feature matrix, ${RF}).` },
      dmr: {
        evidence: 'bench',
        evidenceSource: `DMR voice checked on the bench by RadioFoundry (feature matrix, ${RF}).`,
      },
    },
    'baofeng-dm1701-radiofoundry': {
      fm: { evidence: 'on-air', evidenceSource: `FM transmit checked on the air: ${DM1701_ON_AIR}.` },
      dmr: { evidence: 'on-air', evidenceSource: `DMR voice checked on the air both ways: ${DM1701_ON_AIR}.` },
    },
    'retevis-rt84-radiofoundry': {
      fm: {
        evidence: 'unverified',
        evidenceSource: 'No RadioFoundry record on an RT84. It runs the DM-1701 image, which is checked on the air.',
      },
      dmr: {
        evidence: 'unverified',
        evidenceSource: 'No RadioFoundry record on an RT84. It runs the DM-1701 image, which is checked on the air.',
      },
    },
    'tyt-md9600-radiofoundry': {
      fm: {
        evidence: 'unverified',
        evidenceSource: `RadioFoundry\u2019s MD-9600 check was partial and needs a re-run (feature matrix, ${RF}).`,
      },
      dmr: {
        evidence: 'unverified',
        evidenceSource: `RadioFoundry\u2019s MD-9600 check was partial and needs a re-run (feature matrix, ${RF}).`,
      },
    },
    'retevis-rt90-radiofoundry': {
      fm: {
        evidence: 'unverified',
        evidenceSource: 'No RadioFoundry record on an RT90. It runs the MD-9600 image, whose check was partial.',
      },
      dmr: {
        evidence: 'unverified',
        evidenceSource: 'No RadioFoundry record on an RT90. It runs the MD-9600 image, whose check was partial.',
      },
    },
    'anytone-at-d890uv-mm9pdy': {
      nxdn: { note: 'Only when the radio reports NXDN on. Studio checks before it writes.' },
    },
  },
  firmwareBuilds: {
    radiofoundry: {
      label: `${RF} (${RADIOFOUNDRY_STUDIO_PIN.date})`,
      note:
        'Studio\u2019s RadioFoundry support was checked against this commit. Studio reads the radio\u2019s own build when it connects and says how it differs.',
    },
  },
  featureNotes: {},
};