/** Map tools (`/tools/*`) fill the viewport below the chrome instead of scrolling inside a padded column. */
export function isFullBleedPath(pathname: string): boolean {
  return pathname === '/tools' || pathname.startsWith('/tools/');
}
