import { Alert, Anchor, Text } from '@mantine/core';

export const DM32_PREFER_NEONPLUG_TITLE = 'Prefer NeonPlug to write your DM-32';

/**
 * Strong warning when the active Export egress is native Baofeng DM-32 CPS CSV.
 * Prefer NeonPlug (and Web Serial when available) for radio write.
 * Parent mounts only for the dm32 CPS pathway — not on New Radio.
 */
export default function Dm32PreferNeonPlugAlert() {
  return (
    <Alert color="orange" title={DM32_PREFER_NEONPLUG_TITLE}>
      <Text size="sm">
        Baofeng&apos;s DM-32 CPS often imports CSV incompletely — even when it reports success.
        Studio can&apos;t guarantee a DM-32 CSV download will land correctly in CPS.
      </Text>
      <Text size="sm" mt="xs">
        Switch to the <strong>NeonPlug</strong> pathway on this Export page, download a{' '}
        <code>.neonplug</code> file, then write the radio from{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        . You can still download DM-32 CSV for other tools or testing.
      </Text>
    </Alert>
  );
}
