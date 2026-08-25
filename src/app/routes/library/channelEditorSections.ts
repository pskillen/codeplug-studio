export interface ChannelEditorSection {
  /** Stable anchor id — never rename without updating deep links. */
  id: string;
  /** Panel title and jump-nav label — same string, by construction. */
  label: string;
}

/**
 * Ordered section list for the channel editor jump-nav and Panel ids.
 * `zones` is omitted on New channel (no persisted row to hold zone membership yet).
 */
export function channelEditorSections(opts: { isNew: boolean }): ChannelEditorSection[] {
  const sections: ChannelEditorSection[] = [
    { id: 'identity', label: 'Identity' },
    { id: 'naming', label: 'Names and notes' },
    { id: 'rf', label: 'RF' },
    { id: 'mode-settings', label: 'Mode settings' },
    { id: 'location', label: 'Location' },
  ];
  if (!opts.isNew) {
    sections.push({ id: 'zones', label: 'Zones' });
  }
  sections.push({ id: 'scanning', label: 'Scanning' }, { id: 'aprs', label: 'APRS' });
  return sections;
}
