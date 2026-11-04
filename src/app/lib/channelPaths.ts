/** Read-first channel page — where channel links go by default (#1533). */
export function channelViewPath(channelId: string): string {
  return `/library/channels/${channelId}`;
}

/** Channel editor — link here only when the user's intent is clearly to edit. */
export function channelEditPath(channelId: string): string {
  return `/library/channels/${channelId}/edit`;
}

export const NEW_CHANNEL_PATH = '/library/channels/new';
