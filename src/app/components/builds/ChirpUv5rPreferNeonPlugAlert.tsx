import { Alert, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

export const CHIRP_UV5R_PREFER_NEONPLUG_TITLE =
  "FYI: there's another pathway for UV-5R Mini in the browser";

/**
 * Soft info on CHIRP UV-5R Mini export: mention NeonPlug as an optional browser pathway.
 * Does not urge the operator to leave CHIRP CSV. Parent gates on `formatId === 'chirp'`
 * and `exportProfileId === 'chirp-uv5r'`.
 */
export default function ChirpUv5rPreferNeonPlugAlert() {
  return (
    <Alert color="blue" title={CHIRP_UV5R_PREFER_NEONPLUG_TITLE}>
      <Text size="sm">
        You can also write this radio from the browser with a{' '}
        <Anchor component={Link} to="/builds/new">
          NeonPlug build
        </Anchor>
        . Same library — different export. Keep using this CHIRP CSV if it suits you.
      </Text>
      <Text size="sm" mt="xs">
        NeonPlug writes from{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        .
      </Text>
    </Alert>
  );
}
