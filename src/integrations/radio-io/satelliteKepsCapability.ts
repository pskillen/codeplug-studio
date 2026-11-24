/**
 * Satellite-keps capability declared on `RadioDescriptor` (limits, preview, exclusions).
 * The write function stays in app (`satelliteKepsWriteAdapters.ts`).
 */

import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { OpenGd77SatelliteBankSlot } from '@core/radios/opengd77/satelliteCapability.ts';
import type { SatelliteWritePreviewEntry } from './radios/at-d890uv/index.ts';

export interface SatelliteKepsLimits {
  max: number;
  nameLength: number;
  unitNoun: string;
  nameScope: 'spacecraft' | 'transmitter';
  limitsDoc: string;
}

export interface SatelliteKepsExclusion {
  satelliteId: string;
  transmitterId: string | null;
  reason: string;
}

export interface SatelliteKepsPreviewOptions {
  satelliteOverrides?: readonly BuildEntityOverride[];
}

export type SatelliteKepsPreviewEntry = SatelliteWritePreviewEntry & {
  slot?: OpenGd77SatelliteBankSlot;
  slotCandidates?: {
    transmitterId: string;
    label: string;
    mode: string | null;
    uplinkHz?: number | null;
    downlinkHz?: number | null;
  }[];
};

export type SatelliteKepsPreviewFn = (
  satellites: readonly Satellite[],
  options?: SatelliteKepsPreviewOptions,
) => SatelliteKepsPreviewEntry[];

export type SatelliteKepsExclusionsFn = (
  satellites: readonly Satellite[],
  options?: SatelliteKepsPreviewOptions,
) => SatelliteKepsExclusion[];

export interface SatelliteKepsCapability {
  limits: SatelliteKepsLimits;
  preview: SatelliteKepsPreviewFn;
  exclusions: SatelliteKepsExclusionsFn;
}
