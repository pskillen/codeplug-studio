export interface ChannelEditorSection {
  /** Stable anchor id — never rename without updating deep links. */
  id: string;
  /** Panel title and jump-nav label — same string, by construction. */
  label: string;
}

/**
 * Ordered section list for the channel editor jump-nav and Panel ids.
 * `zones` is omitted on New channel (no persisted row to hold zone membership yet).
 * `modes` appears only when the channel has two or more mode profiles.
 */
export function channelEditorSections(opts: {
  isNew: boolean;
  modeCount: number;
}): ChannelEditorSection[] {
  const sections: ChannelEditorSection[] = [
    { id: 'identity', label: 'Identity' },
    { id: 'mode', label: 'Mode and frequency' },
  ];
  if (opts.modeCount >= 2) {
    sections.push({ id: 'modes', label: 'Modes' });
  }
  sections.push(
    { id: 'transmit', label: 'Transmit' },
    { id: 'naming', label: 'Names and notes' },
    { id: 'location', label: 'Location' },
  );
  if (!opts.isNew) {
    sections.push({ id: 'zones', label: 'Zones' });
  }
  sections.push({ id: 'scanning', label: 'Scanning' }, { id: 'aprs', label: 'APRS' });
  return sections;
}
