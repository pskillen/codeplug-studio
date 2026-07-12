import { Button, Group, PasswordInput, Select, Stack, Text, Anchor } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { MaidenheadGridMode } from '@core/domain/maidenheadGrid.ts';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
import { ListPage, PageSection } from '../components/ui/index.ts';

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
        <Stack gap="sm">
          <GoogleDriveConnectSection />
          <Text size="xs" c="dimmed">
            <Anchor component={Link} to="/attributions" size="xs">
              Google Drive attributions
            </Anchor>
          </Text>
        </Stack>
      </PageSection>

      <PageSection id={SETTINGS_OPENAIP_SECTION_ID} title="OpenAIP">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            API key for airport frequency search via{' '}
            <Anchor href="https://www.openaip.net/" target="_blank" rel="noreferrer">
              OpenAIP
            </Anchor>
            . Stored in this browser only — never sent to Codeplug Studio servers. Requests go
            directly from your browser to OpenAIP.
          </Text>
          <Text size="sm" c="dimmed">
            Obtain a key from your OpenAIP account{' '}
            <Anchor href="https://docs.openaip.net/" target="_blank" rel="noreferrer">
              API Clients
            </Anchor>{' '}
            page after signing in.
          </Text>
          <PasswordInput
            label="OpenAIP API key"
            placeholder="Your API key"
            value={openAipApiKey}
            onChange={(e) => setOpenAipApiKey(e.currentTarget.value)}
          />
          <Group>
            <Button onClick={saveApiKey}>Save key</Button>
            <Button variant="subtle" onClick={clearApiKey}>
              Clear
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Data ©{' '}
            <Anchor href="https://www.openaip.net/" target="_blank" rel="noreferrer">
              OpenAIP
            </Anchor>{' '}
            contributors — programming convenience only; not authoritative for aviation operations.{' '}
            <Anchor component={Link} to="/attributions" size="xs">
              All attributions
            </Anchor>
          </Text>
        </Stack>
      </PageSection>

      <PageSection id={SETTINGS_REPEATERBOOK_SECTION_ID} title="RepeaterBook">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Personal API token for repeater directory search via{' '}
            <Anchor href="https://www.repeaterbook.com/" target="_blank" rel="noreferrer">
              RepeaterBook
            </Anchor>
            . Stored in this browser only — never sent to Codeplug Studio servers. Requests go
            directly from your browser to RepeaterBook.
          </Text>
          <Text size="sm" fw={500}>
            How to obtain your token
          </Text>
          <Stack gap={4}>
            <Text size="sm" c="dimmed">
              1. Log in to{' '}
              <Anchor href="https://www.repeaterbook.com/" target="_blank" rel="noreferrer">
                RepeaterBook.com
              </Anchor>
              .
            </Text>
            <Text size="sm" c="dimmed">
              2. Open{' '}
              <Anchor
                href="https://www.repeaterbook.com/user/api_apps.php"
                target="_blank"
                rel="noreferrer"
              >
                API Apps and Tokens
              </Anchor>
              .
            </Text>
            <Text size="sm" c="dimmed">
              3. Select <strong>Codeplug Studio</strong> (app ID 103).
            </Text>
            <Text size="sm" c="dimmed">
              4. Click <strong>Generate token</strong> and copy the full{' '}
              <code>rbuapp_…</code> value immediately — it is shown only once.
            </Text>
            <Text size="sm" c="dimmed">
              5. Paste the token below and click Save.
            </Text>
          </Stack>
          <PasswordInput
            label="RepeaterBook token"
            placeholder="rbuapp_…"
            value={repeaterBookToken}
            onChange={(e) => setRepeaterBookToken(e.currentTarget.value)}
          />
          <Group>
            <Button onClick={saveRepeaterBookToken}>Save token</Button>
            <Button variant="subtle" onClick={clearRepeaterBookToken}>
              Clear
            </Button>
          </Group>
          <Text size="xs" c="dimmed">
            Data courtesy of{' '}
            <Anchor href="https://www.repeaterbook.com/" target="_blank" rel="noreferrer">
              RepeaterBook.com
            </Anchor>{' '}
            — programming convenience only; not a substitute for RepeaterBook search.{' '}
            <Anchor
              href="https://www.repeaterbook.com/wiki/doku.php?id=api"
              target="_blank"
              rel="noreferrer"
              size="xs"
            >
              API policy
            </Anchor>
          </Text>
        </Stack>
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
            <Text size="xs" c="dimmed">
              Map tiles and geocoding credits —{' '}
              <Anchor component={Link} to="/attributions" size="xs">
                Attributions
              </Anchor>
            </Text>
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
              ]}
            />
          </Stack>
        </Stack>
      </PageSection>
    </ListPage>
  );
}
