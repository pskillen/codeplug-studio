import { captureUv5rMini } from './uv5rMiniCapture.ts';
import { captureRt95 } from './rt95Capture.ts';
import type { DebugArchive } from './captureArchive.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

/** Selected profiles describe expectations, never observed radio identity. */
export interface RadioDebugDescriptor {
  slug: string;
  model: string;
  archiveModelId: string;
  capture?: (opts?: { signal?: AbortSignal; onProgress?: ProgressFn }) => Promise<DebugArchive>;
  family: string;
  capabilities: readonly { name: string; status: 'Not yet available' }[];
}

const unavailable = ['Backup', 'Calibration', 'Memory'].map((name) => ({
  name,
  status: 'Not yet available' as const,
}));

export const radioDebugDescriptors: readonly RadioDebugDescriptor[] = [
  {
    slug: 'at-d890uv',
    model: 'AT-D890UV',
    archiveModelId: 'AT-D890UV',
    family: 'AnyTone · stock / MM9PDY',
    capabilities: unavailable,
  },
  {
    slug: 'dm-32uv',
    model: 'DM-32UV',
    archiveModelId: 'DM-32UV',
    family: 'Baofeng · stock / MM9PDY',
    capabilities: unavailable,
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
    capture: captureRt95,
    model: 'RT95',
    archiveModelId: 'retevis-rt95',
    family: 'Stock / MM9PDY',
    capabilities: unavailable,
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
    capabilities: unavailable,
  },
];
