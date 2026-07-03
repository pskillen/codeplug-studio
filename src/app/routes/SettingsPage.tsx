import { Button, Group, PasswordInput, Select, Stack, Text } from '@mantine/core';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SETTINGS_MAP_SECTION_ID } from '../lib/settingsSections.ts';
import { useMapSettings } from '../hooks/useMapSettings.ts';
import { scrollToPageSection } from '../lib/scrollToPageSection.ts';
import GoogleDriveConnectSection from '../components/settings/GoogleDriveConnectSection.tsx';
import { ListPage, PageSection } from '../components/ui/index.ts';

export default function SettingsPage() {
  const location = useLocation();
  const { mapboxToken, setMapboxToken, saveToken, clearToken, maidenheadGrid, setMaidenheadGrid } =
    useMapSettings();

  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (scrollTo) {
      scrollToPageSection(scrollTo);
    }
  }, [location]);

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

      <PageSection id={SETTINGS_MAP_SECTION_ID} title="Map">
        <Stack gap="lg">
          <Stack gap="sm" id="settings-map-geocode">
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

          <Stack gap="sm" id="settings-maidenhead-grid">
            <Text size="sm" c="dimmed">
              Maximum Maidenhead resolution on library channel and zone maps. Finer grid detail
              appears as you zoom in.
            </Text>
            <Select
              label="Grid overlay"
              value={maidenheadGrid}
              onChange={(value) => {
                if (value) setMaidenheadGrid(value as MaidenheadGridMode);
              }}
              data={[
                { value: 'off', label: 'Off' },
                { value: '4', label: 'Up to 4 characters (~2° × 1°, e.g. IO85)' },
                { value: '6', label: 'Up to 6 characters (~5 km, e.g. IO85mm)' },
                { value: '8', label: 'Up to 8 characters (~500 m, e.g. IO85mm12)' },
              ]}
            />
          </Stack>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
