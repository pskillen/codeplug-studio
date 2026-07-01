import { Checkbox, Group } from '@mantine/core';

export interface MapControlsProps {
  showLabels: boolean;
  onShowLabelsChange: (value: boolean) => void;
  showZones: boolean;
  onShowZonesChange: (value: boolean) => void;
}

export default function MapControls({
  showLabels,
  onShowLabelsChange,
  showZones,
  onShowZonesChange,
}: MapControlsProps) {
  return (
    <Group gap="md" wrap="wrap" align="center">
      <Checkbox
        label="Label with full channel name"
        checked={showLabels}
        onChange={(e) => onShowLabelsChange(e.currentTarget.checked)}
      />
      <Checkbox
        label="Draw zones"
        checked={showZones}
        onChange={(e) => onShowZonesChange(e.currentTarget.checked)}
      />
    </Group>
  );
}
