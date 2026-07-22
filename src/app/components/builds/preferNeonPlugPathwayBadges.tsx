import { Badge } from '@mantine/core';
import type { ReactNode } from 'react';
import type { FormatId } from '@core/import-export/types.ts';

/** Short pathway cues for New build cards — DM32 / NeonPlug only (CHIRP has no pill). */
export function formatPathwayBadge(formatId: FormatId): ReactNode {
  if (formatId === 'dm32') {
    return (
      <Badge size="sm" variant="light" color="orange">
        Prefer NeonPlug
      </Badge>
    );
  }
  if (formatId === 'neonplug') {
    return (
      <Badge size="sm" variant="light" color="blue">
        Recommended
      </Badge>
    );
  }
  return null;
}

export function profilePathwayBadge(profileId: string): ReactNode {
  if (profileId.startsWith('dm32-')) {
    return (
      <Badge size="sm" variant="light" color="orange">
        Prefer NeonPlug
      </Badge>
    );
  }
  if (profileId.startsWith('neonplug-')) {
    return (
      <Badge size="sm" variant="light" color="blue">
        Recommended
      </Badge>
    );
  }
  return null;
}
