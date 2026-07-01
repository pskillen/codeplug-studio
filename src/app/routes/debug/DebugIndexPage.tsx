import { Alert, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';

export default function DebugIndexPage() {
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
        <Text size="sm">
          <Link to="/debug/indexed-db">IndexedDB</Link> — project and library entity rows in the{' '}
          <code>codeplug-studio</code> database.
        </Text>
        <Text size="sm">
          <Link to="/debug/local-storage">LocalStorage</Link> — UI preferences, list filters, and
          tokens persisted as key/value pairs.
        </Text>
      </Stack>
    </Page>
  );
}
