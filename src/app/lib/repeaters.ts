/** ETCC operational status check (wire string at integration boundary). */
export function isOperationalStatus(status: string): boolean {
  return status.trim().toUpperCase() === 'OPERATIONAL';
}

export function queryKindHint(kind: string | null): string | null {
  if (!kind) return null;
  switch (kind) {
    case 'callsign':
      return 'Searching by callsign';
    case 'locator':
      return 'Searching by locator';
    case 'band':
      return 'Searching by band';
    case 'town':
      return 'Searching by town (geocoded to locator)';
    default:
      return null;
  }
}
