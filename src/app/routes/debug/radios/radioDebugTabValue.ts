/** Keep the active tab when the firmware switch still offers it; otherwise fall back to Overview. */
export function resolveRadioDebugTabValue(
  activeTab: string | null,
  tabIds: readonly string[],
): string {
  return activeTab && tabIds.includes(activeTab) ? activeTab : 'overview';
}
