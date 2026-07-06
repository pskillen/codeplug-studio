import { Checkbox, Group } from '@mantine/core';

export type MapControlMode = 'standard' | 'zoneEmphasis' | 'zoneFromLocation';

export interface MapControlsProps {
  mode?: MapControlMode;
  showLabels: boolean;
  onShowLabelsChange: (value: boolean) => void;
  /** Standard mode — draw all zone hulls */
  showZones?: boolean;
  onShowZonesChange?: (value: boolean) => void;
  /** Zone emphasis modes — draw the editing / provisional zone hull */
  showThisZone?: boolean;
  onShowThisZoneChange?: (value: boolean) => void;
  /** Zone emphasis modes — draw other library zones (muted) */
  showOtherZones?: boolean;
  onShowOtherZonesChange?: (value: boolean) => void;
}

export default function MapControls({
  mode = 'standard',
  showLabels,
  onShowLabelsChange,
  showZones = true,
  onShowZonesChange,
  showThisZone = true,
  onShowThisZoneChange,
  showOtherZones = true,
  onShowOtherZonesChange,
}: MapControlsProps) {
  const thisZoneLabel = mode === 'zoneFromLocation' ? 'Draw new zone' : 'Draw this zone';

  return (
    <Group gap="md" wrap="wrap" align="center">
      <Checkbox
        label="Label with full channel name"
        checked={showLabels}
        onChange={(e) => onShowLabelsChange(e.currentTarget.checked)}
      />
      {mode === 'standard' ? (
        <Checkbox
          label="Draw zones"
          checked={showZones}
          onChange={(e) => onShowZonesChange?.(e.currentTarget.checked)}
        />
      ) : (
        <>
          <Checkbox
            label={thisZoneLabel}
            checked={showThisZone}
            onChange={(e) => onShowThisZoneChange?.(e.currentTarget.checked)}
          />
          <Checkbox
            label="Draw other zones"
            checked={showOtherZones}
            onChange={(e) => onShowOtherZonesChange?.(e.currentTarget.checked)}
          />
        </>
      )}
    </Group>
  );
}
