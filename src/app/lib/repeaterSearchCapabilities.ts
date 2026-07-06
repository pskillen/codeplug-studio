import type { RepeaterSource } from '@integrations/repeaters/index.ts';

export interface RepeaterSearchCapabilities {
  unifiedQuery: boolean;
  bandFilter: boolean;
  modeFilter: boolean;
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
      modeFilter: true,
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
    modeFilter: false,
    operationalOnly: false,
    titleCaseNames: false,
    useMyLocation: false,
    locatorColumn: false,
    locationLabel: 'City',
  };
}
