export {
  BRANDMEISTER_CACHE_PREFIX,
  ETCC_CACHE_PREFIX,
  INTEGRATION_CACHE_TTL_MS as DIRECTORY_CACHE_TTL_MS,
  IRTS_CACHE_PREFIX,
  REPEATERBOOK_CACHE_PREFIX,
  clearIntegrationCache as clearDirectoryCache,
  integrationCacheKey as directoryCacheKey,
  readIntegrationCache as readDirectoryCache,
  readStaleIntegrationCache as readStaleDirectoryCache,
  writeIntegrationCache as writeDirectoryCache,
} from '../http/sessionCache.ts';

import { clearIntegrationCache, REPEATERBOOK_CACHE_PREFIX } from '../http/sessionCache.ts';

/** @deprecated Use clearDirectoryCache(REPEATERBOOK_CACHE_PREFIX) */
export function clearRepeaterBookSessionCache(): void {
  clearIntegrationCache(REPEATERBOOK_CACHE_PREFIX);
}
