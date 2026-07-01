import { Button, Stack, Text } from '@mantine/core';
import { IconCurrentLocation } from '@tabler/icons-react';
import { useGeolocation } from '../../hooks/useGeolocation.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';

export interface UseMyLocationButtonProps {
  onLocation: (lat: number, lon: number, accuracyMeters?: number | null) => void;
  disabled?: boolean;
  label?: string;
}

export default function UseMyLocationButton({
  onLocation,
  disabled,
  label = 'Use my location',
}: UseMyLocationButtonProps) {
  const { requestLocation, loading, error, accuracyMeters } = useGeolocation();

  const handleClick = async () => {
    const result = await requestLocation();
    if (result) {
      onLocation(result.lat, result.lon, result.accuracyMeters);
    }
  };

  return (
    <Stack gap={4}>
      <Button
        type="button"
        variant="light"
        loading={loading}
        disabled={disabled}
        leftSection={<IconCurrentLocation size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => void handleClick()}
      >
        {label}
      </Button>
      {error ? (
        <Text size="sm" c="red">
          {error}
        </Text>
      ) : null}
      {!error && accuracyMeters != null && Number.isFinite(accuracyMeters) ? (
        <Text size="xs" c="dimmed">
          ±{Math.round(accuracyMeters)} m
        </Text>
      ) : null}
    </Stack>
  );
}
