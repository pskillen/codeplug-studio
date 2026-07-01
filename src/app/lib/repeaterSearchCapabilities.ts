import type { RepeaterSource } from '@integrations/repeaters/index.ts';

export interface RepeaterSearchCapabilities {
  unifiedQuery: boolean;
  bandFilter: boolean;
  operationalOnly: boolean;
  titleCaseNames: boolean;
  useMyLocation: boolean;
  locatorColumn: boolean;
  locationLabel: 'Town' | 'City';
}

export function repeaterSearchCapabilities(source: RepeaterSource): RepeaterSearchCapabilities {
  if (source === 'ukrepeater') {
    return {
      unifiedQuery: true,
      bandFilter: true,
      operationalOnly: true,
      titleCaseNames: true,
      useMyLocation: true,
      locatorColumn: true,
      locationLabel: 'Town',
    };
  }
  return {
    unifiedQuery: false,
    bandFilter: false,
    operationalOnly: false,
    titleCaseNames: false,
    useMyLocation: false,
    locatorColumn: false,
    locationLabel: 'City',
  };
}
