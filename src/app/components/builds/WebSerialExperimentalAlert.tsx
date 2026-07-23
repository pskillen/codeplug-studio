import { Alert, Text } from '@mantine/core';

export const WEB_SERIAL_EXPERIMENTAL_TITLE = 'Web Serial is experimental';

/**
 * Strong warning on Direct radio (Web Serial) Export chrome.
 * Parent mounts only for radio-io pathways.
 */
export default function WebSerialExperimentalAlert() {
  return (
    <Alert color="orange" title={WEB_SERIAL_EXPERIMENTAL_TITLE}>
      <Text size="sm">
        Writing a radio from the browser is under active development. It is riskier than established
        CPS tools such as CHIRP, NeonPlug, or the manufacturer&apos;s own software.
      </Text>
      <Text size="sm" mt="xs">
        Keep a known-good backup of the radio before you write. Prefer those tools for important
        programming until this pathway is marked stable — we are working quickly to get each Direct
        radio adapter there.
      </Text>
    </Alert>
  );
}
