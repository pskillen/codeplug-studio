/** Whether a primary nav item should show as active for the current pathname. */
export function navActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}
