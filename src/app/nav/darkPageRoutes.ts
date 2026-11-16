/**
 * Pages drawn dark whatever the app theme: the radio debug pages (`/debug/radios/:radio`). The shell
 * paints `main` and the footer dark for them, and wraps the page in a dark v2 scope, so there are no
 * light strips and no negative margins on the page itself.
 */
export function isDarkPagePath(pathname: string): boolean {
  return /^\/debug\/radios\/[^/]+\/?$/.test(pathname);
}
