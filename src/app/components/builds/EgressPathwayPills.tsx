import { Badge, Group } from '@mantine/core';
import {
  IconAlertTriangle,
  IconBrowser,
  IconFileTypeCsv,
  IconPlugConnected,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { CompatibleEgress } from '@core/radio-targets/index.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';

export type PathwayPillTone = 'happiest' | 'neutral' | 'csv' | 'warning';

const PILL_ICON_SIZE = 12;

/** Visual tier for New-build pathway pills. */
export function pathwayPillTone(formatId: string): PathwayPillTone {
  if (formatId === 'radio-io') return 'happiest';
  if (formatId === 'neonplug') return 'neutral';
  if (formatId === 'dm32') return 'warning';
  return 'csv';
}

const TONE_STYLES: Record<
  PathwayPillTone,
  { color: string; variant: 'light' | 'outline' }
> = {
  happiest: { color: 'teal', variant: 'light' },
  neutral: { color: 'gray', variant: 'light' },
  csv: { color: 'yellow', variant: 'light' },
  warning: { color: 'orange', variant: 'outline' },
};

function pathwayPillIcon(tone: PathwayPillTone): ReactNode | undefined {
  switch (tone) {
    case 'happiest':
      return <IconPlugConnected size={PILL_ICON_SIZE} stroke={ICON_STROKE} />;
    case 'neutral':
      return <IconBrowser size={PILL_ICON_SIZE} stroke={ICON_STROKE} />;
    case 'csv':
      return <IconFileTypeCsv size={PILL_ICON_SIZE} stroke={ICON_STROKE} />;
    case 'warning':
      return <IconAlertTriangle size={PILL_ICON_SIZE} stroke={ICON_STROKE} />;
  }
}

export function EgressPathwayPill({ entry }: { entry: CompatibleEgress }) {
  const tone = pathwayPillTone(entry.formatId);
  const style = TONE_STYLES[tone];
  return (
    <Badge
      size="sm"
      variant={style.variant}
      color={style.color}
      leftSection={pathwayPillIcon(tone)}
      styles={
        tone === 'warning'
          ? { root: { borderColor: 'var(--mantine-color-orange-3)' } }
          : undefined
      }
    >
      {entry.label}
    </Badge>
  );
}

export function EgressPathwayPills({ egress }: { egress: readonly CompatibleEgress[] }) {
  return (
    <Group gap={6}>
      {egress.map((entry) => (
        <EgressPathwayPill key={`${entry.formatId}:${entry.profileId}`} entry={entry} />
      ))}
    </Group>
  );
}
