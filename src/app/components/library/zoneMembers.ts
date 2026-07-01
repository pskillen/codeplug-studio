/** Map ordered picker ids to zone member refs. */
export function zoneMembersFromSelectedIds(
  selectedIds: string[],
): { kind: 'channel'; id: string }[] {
  return selectedIds.map((id) => ({ kind: 'channel' as const, id }));
}
