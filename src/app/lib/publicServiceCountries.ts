import { PUBLIC_SERVICE_COUNTRY_SUMMARIES } from '@core/domain/publicServices/data/summaries.ts';
import type {
  PublicServiceCountry,
  PublicServiceCountrySummary,
} from '@core/domain/publicServices/types.ts';

const LOADERS: Record<string, () => Promise<{ default: PublicServiceCountry }>> = {
  GB: () => import('@core/domain/publicServices/data/gb.ts'),
  IE: () => import('@core/domain/publicServices/data/ie.ts'),
};

export function availableCountries(): readonly PublicServiceCountrySummary[] {
  return PUBLIC_SERVICE_COUNTRY_SUMMARIES;
}

export async function loadCountry(code: string): Promise<PublicServiceCountry> {
  const loader = LOADERS[code.toUpperCase()];
  if (!loader) {
    throw new Error(`No public-service dataset for country ${code}`);
  }
  const module = await loader();
  return module.default;
}

/**
 * Map a BCP 47 locale to a shipped country dataset.
 * `en-US` (and any locale whose region is not shipped) returns null — never GB by default.
 */
export function countryCodeFromLocale(locale: string | undefined | null): string | null {
  if (!locale) return null;
  const parts = locale.replaceAll('_', '-').split('-');
  const region = parts.length >= 2 ? parts[parts.length - 1]?.toUpperCase() : undefined;
  if (!region || region.length !== 2) return null;
  return PUBLIC_SERVICE_COUNTRY_SUMMARIES.some((country) => country.countryCode === region)
    ? region
    : null;
}
