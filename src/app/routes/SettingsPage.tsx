import { Anchor, Group, PasswordInput, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import { useEffect } from 'react';
import {
  SETTINGS_MAP_SECTION_ID,
  SETTINGS_OPENAIP_SECTION_ID,
  SETTINGS_REPEATERBOOK_SECTION_ID,
} from '../lib/settingsSections.ts';
import { useMapSettings } from '../hooks/useMapSettings.ts';
import { useOpenAipSettings } from '../hooks/useOpenAipSettings.ts';
import { useRepeaterBookSettings } from '../hooks/useRepeaterBookSettings.ts';
import { scrollToPageSection } from '../lib/scrollToPageSection.ts';
import GoogleDriveConnectSection from '../components/settings/GoogleDriveConnectSection.tsx';
import { Button, DesignSystemV2Provider, Panel } from '../components/v2/index.ts';
import classes from './SettingsPage.module.css';

export default function SettingsPage() {
  const location = useLocation();
  const { mapboxToken, setMapboxToken, saveToken, clearToken, maidenheadGrid, setMaidenheadGrid } =
    useMapSettings();
  const { openAipApiKey, setOpenAipApiKey, saveApiKey, clearApiKey } = useOpenAipSettings();
  const {
    repeaterBookToken,
    setRepeaterBookToken,
    saveToken: saveRepeaterBookToken,
    clearToken: clearRepeaterBookToken,
  } = useRepeaterBookSettings();

  useEffect(() => {
    const scrollTo = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (scrollTo) {
      scrollToPageSection(scrollTo);
    }
  }, [location]);

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        <h1 className={classes.title}>Settings</h1>
        <p className={classes.description}>
          Application preferences. Projects and operator data stay in browser storage only — nothing
          is sent to a server.
        </p>

        <Stack gap="md">
          <Panel id="settings-storage" title="Storage">
            <Stack gap="xs">
              <Text size="sm">
                Projects and library data are stored durably in your browser via IndexedDB, with
                edits synchronised across open tabs.
              </Text>
              <Text size="sm" c="dimmed">
                The active project selection is remembered in localStorage.
              </Text>
            </Stack>
          </Panel>

          <Panel
            id="settings-directory-keys"
            title="Directory API keys"
            sub="Keys for repeater and aviation directory search — stored in this browser only."
          >
            <Stack gap="lg">
              <Stack gap="sm" id={SETTINGS_REPEATERBOOK_SECTION_ID}>
                <Text size="sm" fw={500}>
                  RepeaterBook
                </Text>
                <Text size="sm" c="dimmed">
                  Personal API token for repeater directory search. Requests go directly from your
                  browser to{' '}
                  <Anchor href="https://www.repeaterbook.com/" target="_blank" rel="noreferrer">
                    RepeaterBook
                  </Anchor>
                  .
                </Text>
                <PasswordInput
                  label="RepeaterBook token"
                  placeholder="rbuapp_…"
                  value={repeaterBookToken}
                  onChange={(e) => setRepeaterBookToken(e.currentTarget.value)}
                />
                <Group>
                  <Button size="sm" onClick={saveRepeaterBookToken}>
                    Save token
                  </Button>
                  <Button variant="secondary" size="sm" onClick={clearRepeaterBookToken}>
                    Clear
                  </Button>
                </Group>
              </Stack>

              <Stack gap="sm" id={SETTINGS_OPENAIP_SECTION_ID}>
                <Text size="sm" fw={500}>
                  OpenAIP
                </Text>
                <Text size="sm" c="dimmed">
                  API key for airport frequency search via{' '}
                  <Anchor href="https://www.openaip.net/" target="_blank" rel="noreferrer">
                    OpenAIP
                  </Anchor>
                  .
                </Text>
                <PasswordInput
                  label="OpenAIP API key"
                  placeholder="Your API key"
                  value={openAipApiKey}
                  onChange={(e) => setOpenAipApiKey(e.currentTarget.value)}
                />
                <Group>
                  <Button size="sm" onClick={saveApiKey}>
                    Save key
                  </Button>
                  <Button variant="secondary" size="sm" onClick={clearApiKey}>
                    Clear
                  </Button>
                </Group>
              </Stack>
            </Stack>
          </Panel>

          <Panel id="settings-drive" title="Google Drive">
            <GoogleDriveConnectSection />
          </Panel>

          <Panel
            id={SETTINGS_MAP_SECTION_ID}
            title="Units & locators"
            sub="Map geocoding and Maidenhead grid overlay on library maps."
          >
            <Stack gap="lg">
              <Stack gap="sm" id="settings-map-geocode">
                <PasswordInput
                  label="Mapbox access token"
                  placeholder="pk.…"
                  description="For address geocoding on the Maidenhead tool. Stored in this browser only."
                  value={mapboxToken}
                  onChange={(e) => setMapboxToken(e.currentTarget.value)}
                />
                <Group>
                  <Button size="sm" onClick={saveToken}>
                    Save token
                  </Button>
                  <Button variant="secondary" size="sm" onClick={clearToken}>
                    Clear
                  </Button>
                </Group>
                <Text size="xs" c="dimmed">
                  Map tiles and geocoding credits —{' '}
                  <Anchor component={Link} to="/attributions" size="xs">
                    Attributions
                  </Anchor>
                </Text>
              </Stack>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Maidenhead grid overlay"
                  description="Maximum resolution on library channel and zone maps."
                  value={maidenheadGrid}
                  onChange={(value) => {
                    if (value) setMaidenheadGrid(value as MaidenheadGridMode);
                  }}
                  data={[
                    { value: 'off', label: 'Off' },
                    { value: '4', label: 'Up to 4 characters (~2° × 1°)' },
                    { value: '6', label: 'Up to 6 characters (~5 km)' },
                  ]}
                />
              </SimpleGrid>
            </Stack>
          </Panel>
        </Stack>
      </div>
    </DesignSystemV2Provider>
  );
}
