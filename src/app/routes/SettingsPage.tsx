import { Button, Group, PasswordInput, Stack, Text } from '@mantine/core';
import { useMapSettings } from '../hooks/useMapSettings.ts';
import GoogleDriveConnectSection from '../components/settings/GoogleDriveConnectSection.tsx';
import { ListPage, PageSection } from '../components/ui/index.ts';

export default function SettingsPage() {
  const { mapboxToken, setMapboxToken, saveToken, clearToken } = useMapSettings();

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

      <PageSection id="settings-drive" title="Google Drive">
        <GoogleDriveConnectSection />
      </PageSection>

      <PageSection id="settings-map" title="Map">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Mapbox access token for address geocoding on the Maidenhead reference tool. Stored in
            this browser only — never sent to Codeplug Studio servers.
          </Text>
          <PasswordInput
            label="Mapbox access token"
            placeholder="pk.…"
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.currentTarget.value)}
          />
          <Group>
            <Button onClick={saveToken}>Save token</Button>
            <Button variant="subtle" onClick={clearToken}>
              Clear
            </Button>
          </Group>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
