import { RADIOID_MAX_PER_PAGE } from './constants.ts';
import type { RadioidDmrUserSearchParams } from './types.ts';

export interface RadioidSearchFilterInput {
  id: string;
  callsign: string;
  city: string;
  state: string;
  country: string;
}

export function hasRadioidSearchFilters(filters: RadioidSearchFilterInput): boolean {
  return Boolean(
    filters.id.trim() ||
    filters.callsign.trim() ||
    filters.city.trim() ||
    filters.state.trim() ||
    filters.country.trim(),
  );
}

/** Build RadioID.net query params from UI filters. Returns null when no filter is set. */
export function buildRadioidDmrUserSearchParams(
  filters: RadioidSearchFilterInput,
  page: number,
  perPage = RADIOID_MAX_PER_PAGE,
): RadioidDmrUserSearchParams | null {
  const trimmedId = filters.id.trim();
  const trimmedCallsign = filters.callsign.trim();
  const trimmedCity = filters.city.trim();
  const trimmedState = filters.state.trim();
  const trimmedCountry = filters.country.trim();

  if (!trimmedId && !trimmedCallsign && !trimmedCity && !trimmedState && !trimmedCountry) {
    return null;
  }

  const params: RadioidDmrUserSearchParams = {
    page,
    per_page: perPage,
  };
  if (trimmedId) {
    params.id = trimmedId;
    params.id_sel = '=';
  }
  if (trimmedCallsign) {
    params.callsign = trimmedCallsign;
    params.callsign_sel = 'B';
  }
  if (trimmedCity) {
    params.city = trimmedCity;
    params.city_sel = 'B';
  }
  if (trimmedState) {
    params.state = trimmedState;
    params.state_sel = 'B';
  }
  if (trimmedCountry) {
    params.country = trimmedCountry;
    params.country_sel = 'B';
  }
  return params;
}
