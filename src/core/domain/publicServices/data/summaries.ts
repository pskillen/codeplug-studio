/**
 * Generated country/group summaries. Do not edit by hand.
 * Run `node scripts/public-services/csv-to-dataset.mjs`.
 */
import type { PublicServiceCountrySummary } from '../types.ts';

export const PUBLIC_SERVICE_COUNTRY_SUMMARIES: readonly PublicServiceCountrySummary[] = [
  {
    countryCode: 'GB',
    countryLabel: 'United Kingdom',
    datasetVersion: '2026-09-11',
    groups: [
      {
        groupId: 'gb-ukfrs-fireground',
        label: 'UK FRS national fireground',
        category: 'fire',
        channelCount: 8,
      },
      {
        groupId: 'gb-hmcg-distress',
        label: 'HM Coastguard marine distress & safety',
        category: 'maritime',
        channelCount: 2,
      },
      {
        groupId: 'gb-hmcg-sar',
        label: 'HM Coastguard SAR working',
        category: 'maritime',
        channelCount: 6,
      },
      {
        groupId: 'gb-hmcg-msi',
        label: 'HM Coastguard maritime safety information',
        category: 'maritime',
        channelCount: 3,
      },
      {
        groupId: 'gb-rnli-working',
        label: 'RNLI launch and recovery',
        category: 'sar',
        channelCount: 1,
      },
    ],
  },
  {
    countryCode: 'IE',
    countryLabel: 'Ireland',
    datasetVersion: '2026-09-11',
    groups: [
      {
        groupId: 'ie-marine-distress',
        label: 'Irish Coast Guard — distress and safety',
        category: 'maritime',
        channelCount: 2,
      },
      {
        groupId: 'ie-ircg-working',
        label: 'Irish Coast Guard — VHF working channels',
        category: 'maritime',
        channelCount: 9,
      },
      {
        groupId: 'ie-dublin-port-vts',
        label: 'Dublin Port — Vessel Traffic Service',
        category: 'transport',
        channelCount: 3,
      },
      {
        groupId: 'ie-cork-harbour',
        label: 'Port of Cork — Harbour Radio',
        category: 'transport',
        channelCount: 2,
      },
      {
        groupId: 'ie-shannon-foynes',
        label: 'Shannon Foynes — port working channels',
        category: 'transport',
        channelCount: 2,
      },
    ],
  },
];
