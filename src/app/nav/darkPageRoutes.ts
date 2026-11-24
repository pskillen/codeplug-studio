/**
 * Pages drawn dark whatever the app theme: radio debug pages (`/debug/radios/:radio` redirect and
 * `/debug/radios/:radio/:firmware`). The shell paints `main` and the footer dark for them, so there are
 * no light strips and no negative margins on the page itself; the page draws its own dark v2 scope
 * (`RadioDebugPage`), so standalone and test renders are dark too.
 */
export function isDarkPagePath(pathname: string): boolean {
  return /^\/debug\/radios\/[^/]+(\/[^/]+)?\/?$/.test(pathname);
}
