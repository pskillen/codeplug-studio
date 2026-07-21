import { Alert, Anchor, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

export const DM32_PREFER_NEONPLUG_TITLE = 'Prefer NeonPlug to write your DM-32';

/**
 * Strong warning on DM32 CPS CSV export: prefer NeonPlug for radio write.
 * Parent gates on `formatId === 'dm32'`; this component always renders when mounted.
 */
export default function Dm32PreferNeonPlugAlert() {
  return (
    <Alert color="orange" title={DM32_PREFER_NEONPLUG_TITLE}>
      <Text size="sm">
        Baofeng&apos;s DM-32 CPS often imports CSV incompletely — even when it reports success.
        Studio can&apos;t guarantee this download will land correctly in CPS.
      </Text>
      <Text size="sm" mt="xs">
        Create a{' '}
        <Anchor component={Link} to="/builds/new">
          NeonPlug build
        </Anchor>{' '}
        instead, export a <code>.neonplug</code> file, then write the radio from{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        . You can still download DM-32 CSV for other tools or testing.
      </Text>
    </Alert>
  );
}
