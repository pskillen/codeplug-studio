/** Search param that keeps `/` on the project picker even when a project is selected. */
export const HOME_MANAGE_SEARCH = 'manage';

export const HOME_MANAGE_HREF = `/?${HOME_MANAGE_SEARCH}=1`;

/**
 * Cold start at `/` should open Library when a project is already selected.
 * Explicit picker visits (Manage all / New project) pass `?manage=1`.
 */
export function shouldRedirectHomeToLibrary(
  loading: boolean,
  activeProjectId: string | null,
  searchParams: URLSearchParams,
): boolean {
  if (loading || !activeProjectId) return false;
  return !searchParams.has(HOME_MANAGE_SEARCH);
}
