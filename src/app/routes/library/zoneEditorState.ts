/** React Router location state when opening a new zone from the channels list. */
export interface ZoneEditorLocationState {
  initialChannelIds?: string[];
}

export function readInitialChannelIds(state: unknown): string[] {
  if (typeof state !== 'object' || state == null) return [];
  const ids = (state as ZoneEditorLocationState).initialChannelIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
}
