import { newChannel } from '@core/domain/factories.ts';

export const SAMPLE_ROWS = [
  { id: '1', name: 'GB3DA Stornoway' },
  { id: '2', name: 'GB3IV Inverness' },
];

export const STICKY_DEMO_ROWS = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  name: `Channel ${String(i + 1).padStart(2, '0')}`,
  score: (i * 7) % 100,
}));

export const COLUMN_PICKER_ROWS = [
  { id: '1', name: 'Alpha', score: 3, note: 'A' },
  { id: '2', name: 'Bravo', score: 9, note: 'B' },
];

export const LARGE_VIRTUAL_DEMO_ROWS = Array.from({ length: 250 }, (_, i) => ({
  id: String(i + 1),
  name: `Contact ${String(i + 1).padStart(4, '0')}`,
  score: (i * 13) % 100,
}));

export const sampleChannel = {
  ...newChannel('styleguide', 'Demo FM'),
  rxFrequency: 145_575_000,
  txFrequency: 145_175_000,
  modeProfiles: [
    {
      mode: 'fm' as const,
      squelch: null,
      rxTone: 'none',
      txTone: 'none',
      bandwidthKHz: null,
    },
  ],
};
