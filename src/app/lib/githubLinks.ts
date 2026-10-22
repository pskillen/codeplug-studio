export const GITHUB_REPO_URL = 'https://github.com/pskillen/codeplug-studio';

export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues`;

/** A repository doc on `main`, e.g. `docs/features/x/README.md#section`. The app doesn't serve `docs/`. */
export function githubDocUrl(docPath: string): string {
  return `${GITHUB_REPO_URL}/blob/main/${docPath}`;
}
