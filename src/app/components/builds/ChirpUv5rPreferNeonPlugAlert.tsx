import { Alert, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

/**
 * Soft hint on CHIRP UV-5R Mini export: prefer NeonPlug while CHIRP support matures.
 * Parent gates on `formatId === 'chirp'` and `exportProfileId === 'chirp-uv5r'`.
 */
export default function ChirpUv5rPreferNeonPlugAlert() {
  return (
    <Alert color="yellow" title="CHIRP UV-5R support is in progress">
      <Text size="sm">
        CHIRP CSV export for UV-5R Mini is not fully tested yet. Prefer a{' '}
        <Anchor component={Link} to="/builds/new">
          NeonPlug build
        </Anchor>{' '}
        (Baofeng UV-5R Mini) and export <code>.neonplug</code>, which is fully supported.
      </Text>
      <Text size="sm" mt="xs">
        External write path:{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        . CHIRP CSV download remains available.
      </Text>
    </Alert>
  );
}
