import { Anchor, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { Link, useLocation } from 'react-router-dom';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import { useEffect } from 'react';
import { SETTINGS_MAP_SECTION_ID } from '../lib/settingsSections.ts';
import {
  MAPBOX_TOKEN_GUIDE,
  OPENAIP_API_KEY_GUIDE,
  REPEATERBOOK_TOKEN_GUIDE,
} from '../lib/credentialGuides.tsx';
import { useMapSettings } from '../hooks/useMapSettings.ts';
import { useOpenAipSettings } from '../hooks/useOpenAipSettings.ts';
import { useRepeaterBookSettings } from '../hooks/useRepeaterBookSettings.ts';
import { scrollToPageSection } from '../lib/scrollToPageSection.ts';
import CredentialSetupField from '../components/settings/CredentialSetupField.tsx';
import GoogleDriveConnectSection from '../components/settings/GoogleDriveConnectSection.tsx';
import { DesignSystemV2Provider, Panel } from '../components/v2/index.ts';
import classes from './SettingsPage.module.css';

export default function SettingsPage() {
  const location = useLocation();
  const map = useMapSettings();
  const { maidenheadGrid, setMaidenheadGrid } = map;
  const openAip = useOpenAipSettings();
  const repeaterBook = useRepeaterBookSettings();

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
            title="API keys and tokens"
            sub="Some features use third-party services that need your own free key. Each key stays in this browser and is sent only to the service it belongs to."
          >
            <Stack gap="lg">
              <CredentialSetupField
                guide={REPEATERBOOK_TOKEN_GUIDE}
                value={repeaterBook.repeaterBookTokenDraft}
                onChange={repeaterBook.setRepeaterBookToken}
                hasSavedValue={repeaterBook.hasToken}
                isDirty={repeaterBook.isDirty}
                onSave={repeaterBook.saveToken}
                onClear={repeaterBook.clearToken}
              />
              <CredentialSetupField
                guide={OPENAIP_API_KEY_GUIDE}
                value={openAip.openAipApiKeyDraft}
                onChange={openAip.setOpenAipApiKey}
                hasSavedValue={openAip.hasApiKey}
                isDirty={openAip.isDirty}
                onSave={openAip.saveApiKey}
                onClear={openAip.clearApiKey}
              />
              <CredentialSetupField
                guide={MAPBOX_TOKEN_GUIDE}
                value={map.mapboxTokenDraft}
                onChange={map.setMapboxToken}
                hasSavedValue={map.mapboxToken.length > 0}
                isDirty={map.isMapboxTokenDirty}
                onSave={map.saveToken}
                onClear={map.clearToken}
              />
              <Text size="xs" c="dimmed">
                Map tiles and geocoding credits —{' '}
                <Anchor component={Link} to="/attributions" size="xs">
                  Attributions
                </Anchor>
              </Text>
            </Stack>
          </Panel>

          <Panel id="settings-drive" title="Google Drive">
            <GoogleDriveConnectSection />
          </Panel>

          <Panel
            id={SETTINGS_MAP_SECTION_ID}
            title="Units & locators"
            sub="Maidenhead grid overlay on library maps. The Mapbox geocoding token is under API keys and tokens."
          >
            <Stack gap="lg">
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
