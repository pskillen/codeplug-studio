import type { ComponentType } from 'react';
import { Dm32Calibration } from './Dm32Calibration.tsx';
import { Dm32DecodedDiff } from './Dm32DecodedDiff.tsx';
import { AtD890Calibration } from './AtD890Calibration.tsx';
import { AtD890Compare } from './AtD890Compare.tsx';
import { Rt95Calibration, Rt95CalibrationDiff } from './Rt95Calibration.tsx';
import { captureAtD890 } from './atD890Capture.ts';
import { captureDm32 } from './dm32Capture.ts';
import { captureUv5rMini } from './uv5rMiniCapture.ts';
import { captureRt95 } from './rt95Capture.ts';
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
  family: string;
  capabilities: readonly RadioDebugCapability[];
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
    capabilities: capabilities('Available', 'Partial', 'Not yet available'),
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
    model: 'DM-1701',
    archiveModelId: 'DM-1701',
    family: 'OpenGD77',
    capabilities: unavailable,
  },
  {
    slug: 'md-9600-opengd77',
    model: 'MD-9600',
    archiveModelId: 'MD-9600',
    family: 'OpenGD77',
    capabilities: unavailable,
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
