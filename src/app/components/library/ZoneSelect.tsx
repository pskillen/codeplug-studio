import { Select } from '@mantine/core';
import type { Zone } from '@core/models/library.ts';
import { sortByName } from '../../lib/channels.ts';

export interface ZoneSelectProps {
  label: string;
  zones: Zone[];
  value: string | null;
  onChange: (zoneId: string | null) => void;
}

export default function ZoneSelect({ label, zones, value, onChange }: ZoneSelectProps) {
  const data = sortByName(zones).map((zone) => ({ value: zone.id, label: zone.name }));

  return (
    <Select
      label={label}
      placeholder="Choose a zone"
      data={data}
      value={value}
      onChange={onChange}
      searchable
      clearable
    />
  );
}
