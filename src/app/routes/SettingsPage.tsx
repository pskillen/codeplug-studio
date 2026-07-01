import { Stack, Text } from '@mantine/core';
import { ListPage, PageSection } from '../components/ui/index.ts';

export default function SettingsPage() {
  return (
    <ListPage
      width="narrow"
      title="Settings"
      description="Application preferences. Projects and operator data stay in browser storage only — nothing is sent to a server."
    >
      <PageSection id="settings-storage" title="Storage">
        <Stack gap="xs">
          <Text size="sm">
            Projects and library data are stored durably in your browser via IndexedDB, with edits
            synchronised across open tabs.
          </Text>
          <Text size="sm" c="dimmed">
            The active project selection is remembered in localStorage.
          </Text>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
