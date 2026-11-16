import type { ComponentType } from 'react';
import { Dm32Calibration } from './Dm32Calibration.tsx';
import { Dm32DecodedDiff } from './Dm32DecodedDiff.tsx';
import { OpenGd77Calibration } from './OpenGd77Calibration.tsx';
import { OpenGd77DecodedDiff } from './OpenGd77DecodedDiff.tsx';
import { AtD890Calibration } from './AtD890Calibration.tsx';
import { AtD890Compare } from './AtD890Compare.tsx';
import { Rt95Calibration, Rt95CalibrationDiff } from './Rt95Calibration.tsx';
import { captureAtD890 } from './atD890Capture.ts';
import { captureDm32 } from './dm32Capture.ts';
import { captureUv5rMini } from './uv5rMiniCapture.ts';
import { captureRt95 } from './rt95Capture.ts';
import { captureOpenGd77 } from './opengd77Capture.ts';
import { openGd77IdentityRows } from './opengd77Identity.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import type { DebugArchive } from './captureArchive.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

export type DebugCalibrationProps = { archive?: DebugArchive; overlayArchive?: DebugArchive };
export type DebugDecodedDiffProps = { first: DebugArchive; second: DebugArchive };

/** Selected profiles describe expectations, never observed radio identity. */
export interface RadioDebugDescriptor {
  slug: string;
  model: string;
  archiveModelId: string;
  capture?: (opts?: { signal?: AbortSignal; onProgress?: ProgressFn }) => Promise<DebugArchive>;
  Calibration?: ComponentType<DebugCalibrationProps>;
  DecodedDiff?: ComponentType<DebugDecodedDiffProps>;
  /** Keep every read and opened archive in the shared tab-only history, with Compare. */
  readHistory?: boolean;
  family: string;
  capabilities: readonly RadioDebugCapability[];
  /** Overview rows after `Model · selected`, for a profile with its own identity evidence. */
  identityRows?: (input: {
    archive?: DebugArchive;
    connection: string;
  }) => readonly (readonly [string, string])[];
  /** Caption under the identity grid, after the generic sentence. */
  identityNote?: string;
  /** Backup-tab notice about what the read sends and how to recover. */
  readNotice?: { title: string; text: string };
}

export type RadioDebugCapabilityStatus = 'Available' | 'Partial' | 'Not yet available';

export interface RadioDebugCapability {
  name: 'Backup' | 'Calibration' | 'Memory';
  status: RadioDebugCapabilityStatus;
}

const capabilities = (
  backup: RadioDebugCapabilityStatus,
  calibration: RadioDebugCapabilityStatus,
  memory: RadioDebugCapabilityStatus,
): readonly RadioDebugCapability[] => [
  { name: 'Backup', status: backup },
  { name: 'Calibration', status: calibration },
  { name: 'Memory', status: memory },
];

const unavailable = capabilities('Not yet available', 'Not yet available', 'Not yet available');

/** Badge colour for a capability status. */
export const capabilityColor = (status: RadioDebugCapabilityStatus) =>
  status === 'Available' ? 'green' : status === 'Partial' ? 'yellow' : 'gray';

const OPENGD77_IDENTITY_NOTE =
  'Values are the captured FirmwareInfo reply, as reported. A revision string is not proof of provenance. The reply has no serial and cannot tell stock builds from forks or mods. Radio type does not distinguish DM-1701 from RT-84 or MD-9600 from RT-90.';

const OPENGD77_READ_NOTICE = {
  title: 'Read-only capture and recovery',
  text: 'The capture only reads: it sends a ping, the FirmwareInfo request, the CPS screen command, reads of the registered flash spans and the occupied User Database, and the CPS close. It takes minutes, and a large User Database makes it much longer. Cancel stops at the next frame and sends only the CPS close. If the radio stays on the CPS screen after a failure, power-cycle it.',
};

export const radioDebugDescriptors: readonly RadioDebugDescriptor[] = [
  {
    slug: 'at-d890uv',
    Calibration: AtD890Calibration,
    DecodedDiff: AtD890Compare,
    capture: captureAtD890,
    model: 'AT-D890UV',
    archiveModelId: 'AT-D890UV',
    family: 'AnyTone · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'dm-32uv',
    Calibration: Dm32Calibration,
    DecodedDiff: Dm32DecodedDiff,
    capture: captureDm32,
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV',
    family: 'Baofeng · stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'dm-32uv-radiofoundry',
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV-RadioFoundry',
    family: 'RadioFoundry',
    capabilities: unavailable,
  },
  {
    slug: 'dm-1701-opengd77',
    Calibration: OpenGd77Calibration,
    DecodedDiff: OpenGd77DecodedDiff,
    readHistory: true,
    capture: captureOpenGd77(OPENGD77_DM1701_MODEL_ID),
    model: 'DM-1701',
    archiveModelId: 'DM-1701',
    family: 'OpenGD77',
    capabilities: capabilities('Available', 'Partial', 'Not yet available'),
    identityRows: openGd77IdentityRows,
    identityNote: OPENGD77_IDENTITY_NOTE,
    readNotice: OPENGD77_READ_NOTICE,
  },
  {
    slug: 'md-9600-opengd77',
    Calibration: OpenGd77Calibration,
    DecodedDiff: OpenGd77DecodedDiff,
    readHistory: true,
    capture: captureOpenGd77(OPENGD77_MD9600_MODEL_ID),
    model: 'MD-9600',
    archiveModelId: 'MD-9600',
    family: 'OpenGD77',
    capabilities: capabilities('Available', 'Partial', 'Not yet available'),
    identityRows: openGd77IdentityRows,
    identityNote: OPENGD77_IDENTITY_NOTE,
    readNotice: OPENGD77_READ_NOTICE,
  },
  {
    slug: 'rt95',
    Calibration: Rt95Calibration,
    DecodedDiff: Rt95CalibrationDiff,
    capture: captureRt95,
    model: 'RT95',
    archiveModelId: 'retevis-rt95',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
  {
    slug: 'uv-21-pro-v2',
    model: 'UV-21 Pro V2',
    archiveModelId: 'UV-21Pro V2',
    family: 'Stock family',
    capabilities: unavailable,
  },
  {
    slug: 'uv-5r-mini',
    capture: captureUv5rMini,
    model: 'UV-5R Mini',
    archiveModelId: 'UV-5R Mini',
    family: 'Stock / MM9PDY',
    capabilities: capabilities('Available', 'Partial', 'Partial'),
  },
];
