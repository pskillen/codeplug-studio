/** RadioID.net string match selector for query params (`=`, `L`, `B`, `E`). */
export type RadioidStringSelector = '=' | 'L' | 'B' | 'E';

export interface RadioidDmrUserListing {
  id: number;
  callsign: string;
  fname: string;
  surname: string;
  name: string;
  city: string;
  state: string;
  country: string;
}

export interface RadioidDmrUserSearchParams {
  id?: string;
  id_sel?: '=' | 'B';
  callsign?: string;
  callsign_sel?: RadioidStringSelector;
  city?: string;
  city_sel?: RadioidStringSelector;
  state?: string;
  state_sel?: RadioidStringSelector;
  country?: string;
  country_sel?: RadioidStringSelector;
  page?: number;
  per_page?: number;
}

export interface RadioidDmrUserSearchResult {
  listings: RadioidDmrUserListing[];
  count: number;
  page: number;
  pages: number;
  perPage: number;
}
