import { Alert, Anchor, Text } from '@mantine/core';

export const DM32_PREFER_NEONPLUG_TITLE = 'Prefer NeonPlug to write your DM-32';

/**
 * Strong warning for Baofeng DM-32UV: prefer NeonPlug egress over CPS CSV for radio write.
 * Parent gates on the DM-32UV radio target; this component always renders when mounted.
 */
export default function Dm32PreferNeonPlugAlert() {
  return (
    <Alert color="orange" title={DM32_PREFER_NEONPLUG_TITLE}>
      <Text size="sm">
        Baofeng&apos;s DM-32 CPS often imports CSV incompletely — even when it reports success.
        Studio can&apos;t guarantee a DM-32 CSV download will land correctly in CPS.
      </Text>
      <Text size="sm" mt="xs">
        After creating this radio build, choose the <strong>NeonPlug</strong> pathway on Export,
        download a <code>.neonplug</code> file, then write the radio from{' '}
        <Anchor href="https://neonplug.app" target="_blank" rel="noopener noreferrer">
          neonplug.app
        </Anchor>
        . You can still download DM-32 CSV for other tools or testing.
      </Text>
    </Alert>
  );
}
