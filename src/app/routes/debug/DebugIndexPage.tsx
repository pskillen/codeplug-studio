import { Alert, Stack, Switch, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';

export default function DebugIndexPage() {
  const [developerMode, setDeveloperMode] = useDeveloperMode();
  return (
    <Page>
      <PageHeader
        title="Debug"
        description="Read-only inspection tools for browser-local app state."
      />
      <Stack gap="md">
        <Alert color="yellow" title="Browser-local data">
          Data shown here stays in your browser and may include operator codeplug content. Nothing
          is sent to a server. Do not commit exports or screenshots that contain personal data.
        </Alert>
        <Switch
          label="Developer mode on this device"
          description="Shows the Debug pages and prod-hidden firmware flashing on the production site. Stored in this browser only. Tapping the version in the footer five times does the same."
          checked={developerMode}
          onChange={(e) => setDeveloperMode(e.currentTarget.checked)}
        />
        <Text size="sm">
          <Link to="/debug/indexed-db">IndexedDB</Link> — project and library entity rows in the{' '}
          <code>codeplug-studio</code> database.
        </Text>
        <Text size="sm">
          <Link to="/debug/local-storage">LocalStorage</Link> — UI preferences, list filters, and
          tokens persisted as key/value pairs.
        </Text>
        <Text size="sm">
          <Link to="/debug/d890-erase-probe">AT-D890UV erase-unit probe</Link> — measures the flash
          erase unit that Write must read-modify-write, plus a read-only config-region alias check
          (#792). <strong>Erase passes write to the radio;</strong> the alias check does not.
        </Text>
        <Text size="sm">
          <Link to="/debug/serial-reopen">Serial reopen timing</Link> — times a Web Serial close and
          reopen at a new baud rate with a USB serial cable alone (no radio) (#1584).
        </Text>
      </Stack>
    </Page>
  );
}
