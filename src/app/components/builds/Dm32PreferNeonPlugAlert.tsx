import { Alert, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

/**
 * Strong warning on DM32 CPS CSV export: prefer NeonPlug for radio write.
 * Parent gates on `formatId === 'dm32'`; this component always renders when mounted.
 */
export default function Dm32PreferNeonPlugAlert() {
  return (
    <Alert color="orange" title="DM-32 CPS export is deprecated for radio write">
      <Text size="sm">
        Baofeng DM-32 CPS is too full of bugs for Codeplug Studio to ensure what leaves this app
        will make it into CPS — even a “successful” import is often incomplete. Prefer a{' '}
        <Anchor component={Link} to="/builds/new">
          NeonPlug build
        </Anchor>{' '}
        and export <code>.neonplug</code> (merge into a radio-read base when writing to the radio).
      </Text>
      <Text size="sm" mt="xs">
        External write path:{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        . DM-32 CSV download remains available for interop and fixtures.
      </Text>
    </Alert>
  );
}
