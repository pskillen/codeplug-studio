import type { RepeaterSource } from '@integrations/repeaters/index.ts';

export interface RepeaterSearchCapabilities {
  unifiedQuery: boolean;
  bandFilter: boolean;
  modeFilter: boolean;
  geometryFilter: boolean;
  operationalOnly: boolean;
  titleCaseNames: boolean;
  useMyLocation: boolean;
  locatorFilter: boolean;
  countryAutocomplete: boolean;
  locationLabel: 'Town' | 'City';
  regionSelector: boolean;
}

export function repeaterSearchCapabilities(source: RepeaterSource): RepeaterSearchCapabilities {
  if (source === 'ukrepeater') {
    return {
      unifiedQuery: true,
      bandFilter: true,
      modeFilter: true,
      geometryFilter: true,
      operationalOnly: true,
      titleCaseNames: true,
      useMyLocation: true,
      locatorFilter: false,
      countryAutocomplete: false,
      locationLabel: 'Town',
      regionSelector: false,
    };
  }
  if (source === 'irts') {
    return {
      unifiedQuery: false,
      bandFilter: true,
      modeFilter: true,
      geometryFilter: false,
      operationalOnly: false,
      titleCaseNames: true,
      useMyLocation: false,
      locatorFilter: false,
      countryAutocomplete: false,
      locationLabel: 'City',
      regionSelector: false,
    };
  }
  if (source === 'repeaterbook') {
    return {
      unifiedQuery: false,
      bandFilter: true,
      modeFilter: true,
      geometryFilter: true,
      operationalOnly: true,
      titleCaseNames: true,
      useMyLocation: true,
      locatorFilter: true,
      countryAutocomplete: true,
      locationLabel: 'City',
      regionSelector: true,
    };
  }
  return {
    unifiedQuery: false,
    bandFilter: false,
    modeFilter: false,
    geometryFilter: false,
    operationalOnly: false,
    titleCaseNames: false,
    useMyLocation: false,
    locatorFilter: false,
    countryAutocomplete: false,
    locationLabel: 'City',
    regionSelector: false,
  };
}
