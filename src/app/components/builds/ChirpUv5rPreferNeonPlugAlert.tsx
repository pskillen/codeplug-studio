import { Alert, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

export const CHIRP_UV5R_PREFER_NEONPLUG_TITLE = 'CHIRP for UV-5R Mini is still being tested';

/**
 * Soft hint on CHIRP UV-5R Mini export: prefer NeonPlug while CHIRP support matures.
 * Parent gates on `formatId === 'chirp'` and `exportProfileId === 'chirp-uv5r'`.
 */
export default function ChirpUv5rPreferNeonPlugAlert() {
  return (
    <Alert color="yellow" title={CHIRP_UV5R_PREFER_NEONPLUG_TITLE}>
      <Text size="sm">
        This CSV path isn&apos;t fully proven yet. Prefer a{' '}
        <Anchor component={Link} to="/builds/new">
          NeonPlug build
        </Anchor>{' '}
        for UV-5R Mini — that export is supported end to end. You can still download CHIRP CSV if
        you need it.
      </Text>
      <Text size="sm" mt="xs">
        Write the radio from{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        .
      </Text>
    </Alert>
  );
}
