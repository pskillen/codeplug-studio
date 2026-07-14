import { useCallback, useState } from 'react';
import {
  RadioidDirectoryError,
  RADIOID_PROVIDER,
  searchRadioidDmrUsers,
  type RadioidDmrUserListing,
  type RadioidDmrUserSearchParams,
} from '@integrations/radioid/index.ts';
import { isRateLimited } from '@integrations/http/rateLimit.ts';
import { RADIOID_RATE_LIMIT_MESSAGE } from '@integrations/radioid/constants.ts';

export interface RadioidSearchFilters {
  id: string;
  callsign: string;
  city: string;
  state: string;
  country: string;
}

const EMPTY_FILTERS: RadioidSearchFilters = {
  id: '',
  callsign: '',
  city: '',
  state: '',
  country: '',
};

export function useRadioidContactSearch() {
  const [filters, setFilters] = useState<RadioidSearchFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RadioidDmrUserListing[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const search = useCallback(
    async (pageOverride?: number) => {
      const targetPage = pageOverride ?? page;
      const trimmedId = filters.id.trim();
      const trimmedCallsign = filters.callsign.trim();
      const trimmedCity = filters.city.trim();
      const trimmedState = filters.state.trim();
      const trimmedCountry = filters.country.trim();

      if (
        !trimmedId &&
        !trimmedCallsign &&
        !trimmedCity &&
        !trimmedState &&
        !trimmedCountry
      ) {
        setError('Enter at least one search filter (DMR ID, callsign, city, state, or country).');
        return;
      }

      if (isRateLimited(RADIOID_PROVIDER)) {
        setError(RADIOID_RATE_LIMIT_MESSAGE);
        return;
      }

      const params: RadioidDmrUserSearchParams = {
        page: targetPage,
        per_page: 100,
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

      setLoading(true);
      setError(null);
      try {
        const result = await searchRadioidDmrUsers(params);
        setListings(result.listings);
        setPage(result.page);
        setTotalPages(result.pages);
        setTotalCount(result.count);
        if (result.listings.length === 0) {
          setError('No DMR users matched your search on RadioID.net.');
        }
      } catch (err) {
        setListings([]);
        setTotalCount(0);
        setTotalPages(1);
        if (err instanceof RadioidDirectoryError) {
          setError(err.message);
        } else {
          setError('Search failed — try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [filters, page],
  );

  const updateFilter = useCallback(
    (key: keyof RadioidSearchFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    [],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      void search(nextPage);
    },
    [search],
  );

  return {
    filters,
    updateFilter,
    loading,
    error,
    listings,
    page,
    totalPages,
    totalCount,
    search,
    goToPage,
  };
}
