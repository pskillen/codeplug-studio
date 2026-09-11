import type { ChannelTone, DMRTimeSlot } from '../../models/library.ts';

export type PublicServiceCategory =
  'fire' | 'maritime' | 'sar' | 'ambulance' | 'utility' | 'transport' | 'event' | 'other';

export type PublicServiceMode = 'fm' | 'dmr';

export type PublicServiceStatus = 'active' | 'historic' | 'planned' | 'unknown';

export type PublicServiceConfidence = 'high' | 'medium' | 'low';

export type PublicServiceSourceType = 'regulator' | 'official' | 'foi' | 'industry' | 'community';

export interface PublicServiceModeSpec {
  mode: PublicServiceMode;
  isPrimary: boolean;
  bandwidthKHz?: number;
  rxTone?: ChannelTone;
  txTone?: ChannelTone;
  colourCode?: number;
  timeslot?: DMRTimeSlot;
}

export interface PublicServiceSource {
  type: PublicServiceSourceType;
  url: string;
  title: string;
  date?: string;
  url2?: string;
}

export interface PublicServiceEntry {
  channelId: string;
  name: string;
  label: string;
  rxFrequencyHz: number;
  txFrequencyHz: number;
  modes: readonly PublicServiceModeSpec[];
  status: PublicServiceStatus;
  confidence: PublicServiceConfidence;
  source: PublicServiceSource;
  notes?: string;
}

export interface PublicServiceGroup {
  groupId: string;
  label: string;
  category: PublicServiceCategory;
  serviceOrg?: string;
  region?: string;
  entries: readonly PublicServiceEntry[];
}

export interface PublicServiceKnownGap {
  category: PublicServiceCategory;
  summary: string;
  sourceUrl?: string;
}

export interface PublicServiceCountry {
  countryCode: string;
  countryLabel: string;
  datasetVersion: string;
  groups: readonly PublicServiceGroup[];
  knownGaps: readonly PublicServiceKnownGap[];
}

export interface PublicServiceGroupSummary {
  groupId: string;
  label: string;
  category: PublicServiceCategory;
  channelCount: number;
}

export interface PublicServiceCountrySummary {
  countryCode: string;
  countryLabel: string;
  datasetVersion: string;
  groups: readonly PublicServiceGroupSummary[];
}
