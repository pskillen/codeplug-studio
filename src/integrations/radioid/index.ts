export { searchRadioidDmrUsers } from './client.ts';
export {
  buildRadioidDmrUserSearchParams,
  hasRadioidSearchFilters,
  type RadioidSearchFilterInput,
} from './buildSearchParams.ts';
export {
  DEFAULT_RADIOID_CONTACT_NAME_MODE,
  isRadioidContactNameMode,
  radioidContactNameModeLabel,
  radioidListingImportName,
  RADIOID_CONTACT_NAME_MODES,
  type RadioidContactNameMode,
} from './contactName.ts';
export {
  applyRadioidListingUpdates,
  buildDigitalContactPatchFromDiff,
  diffDigitalContactFromListing,
  diffHasChanges,
  radioidListingDisplayName,
  type DigitalContactDiffField,
  type DigitalContactDiffRow,
} from './contactDiff.ts';
export {
  RADIOID_DMR_USER_PROXY_PATH,
  RADIOID_MAX_PER_PAGE,
  RADIOID_NETWORK_ERROR_MESSAGE,
  RADIOID_PROVIDER,
  RADIOID_RATE_LIMIT_MESSAGE,
} from './constants.ts';
export { RadioidDirectoryError } from './errors.ts';
export {
  findDigitalContactByCallsign,
  findDigitalContactByDigitalId,
} from './findDigitalContact.ts';
export { mapRadioidUserToDigitalContact } from './mapToDigitalContact.ts';
export type {
  RadioidDmrUserListing,
  RadioidDmrUserSearchParams,
  RadioidDmrUserSearchResult,
  RadioidStringSelector,
} from './types.ts';
