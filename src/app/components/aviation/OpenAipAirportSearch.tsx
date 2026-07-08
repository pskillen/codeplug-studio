import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Button,
  Card,
  Checkbox,
  Collapse,
  Group,
  NumberInput,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSearch } from '@tabler/icons-react';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AirportListing } from '@integrations/aviation/index.ts';
import { airportQueryKindHint } from '@integrations/aviation/index.ts';
import { buildAirbandImportPlan } from '@core/services/airbandImport.ts';
import { SETTINGS_OPENAIP_SECTION_ID } from '../../lib/settingsSections.ts';
import { useOpenAipAirportSearch } from '../../hooks/useOpenAipAirportSearch.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  airportListingKey,
  airportListingToAirbandInput,
  formatAirportDistanceKm,
  formatFrequencyMhz,
} from '../../lib/openAipAirport.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useProjects } from '../../state/useProjects.ts';
import UseMyLocationButton from '../UseMyLocationButton/UseMyLocationButton.tsx';
import { FormPage, PageSection } from '../ui/index.ts';
import CodeplugMap from '../CodeplugMap/CodeplugMap.tsx';

function mapChannelsFromAirports(airports: AirportListing[]): Channel[] {
  return airports
    .filter((airport) => airport.location != null)
    .map((airport) => {
      const name = airport.iata ?? airport.icao ?? airport.name;
      const base = newChannel('map-preview', name);
      return {
        ...base,
        rxFrequency: airport.frequencies[0]?.rxFrequencyHz ?? null,
        location: airport.location,
        useLocation: true,
      };
    });
}

function AirportCard({
  airport,
  referencePoint,
  selected,
  onToggle,
  onAdd,
  adding,
}: {
  airport: AirportListing;
  referencePoint: { lat: number; lon: number } | null;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  const [expanded, setExpanded] = useState(airport.frequencies.length <= 6);
  const distance = formatAirportDistanceKm(airport, referencePoint);
  const codes = [airport.icao, airport.iata].filter(Boolean).join(' / ');

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Group align="flex-start" gap="sm" wrap="nowrap">
            <Checkbox
              checked={selected}
              onChange={(e) => onToggle(e.currentTarget.checked)}
              aria-label={`Select ${airport.name}`}
              mt={4}
            />
            <Stack gap={2}>
              <Text fw={600}>{airport.name}</Text>
              <Text size="sm" c="dimmed">
                {codes || 'No ICAO/IATA'}
                {distance ? ` · ${distance}` : ''}
                {airport.elevationM != null ? ` · ${airport.elevationM} m` : ''}
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={onAdd} loading={adding}>
              Add
            </Button>
            {airport.frequencies.length > 6 ? (
              <Button
                size="xs"
                variant="subtle"
                onClick={() => setExpanded((v) => !v)}
                rightSection={
                  expanded ? (
                    <IconChevronUp size={14} stroke={ICON_STROKE} />
                  ) : (
                    <IconChevronDown size={14} stroke={ICON_STROKE} />
                  )
                }
              >
                {expanded ? 'Hide' : 'Show'} frequencies
              </Button>
            ) : null}
          </Group>
        </Group>

        <Collapse in={expanded}>
          {airport.frequencies.length === 0 ? (
            <Text size="sm" c="dimmed">
              No published frequencies in OpenAIP for this airport.
            </Text>
          ) : (
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Service</Table.Th>
                  <Table.Th>Frequency</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {airport.frequencies.map((freq, index) => (
                  <Table.Tr key={`${freq.service}-${freq.rxFrequencyHz}-${index}`}>
                    <Table.Td>{freq.service}</Table.Td>
                    <Table.Td>{formatFrequencyMhz(freq.rxFrequencyHz)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Collapse>
      </Stack>
    </Card>
  );
}

export default function OpenAipAirportSearch() {
  const search = useOpenAipAirportSearch();
  const { library } = useLibrary();
  const { activeProjectId } = useProjects();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const mapChannels = useMemo(() => mapChannelsFromAirports(search.airports), [search.airports]);
  const kindHint = airportQueryKindHint(search.kind);

  function toggleRow(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(search.airports.map(airportListingKey)));
  }

  async function persistAirports(airports: AirportListing[]) {
    if (!activeProjectId) return;
    const inputs = airports.map(airportListingToAirbandInput);
    const plan = buildAirbandImportPlan(library, activeProjectId, inputs, {
      alsoCreateZone: search.alsoCreateZone,
      forbidTransmit: true,
    });

    for (const channel of plan.totalChannelsToAdd) {
      await persistence.putChannel(channel, null);
    }
    for (const zone of plan.zones) {
      await persistence.putZone(zone, null);
    }

    const added = plan.totalChannelsToAdd.length;
    const skipped = plan.totalSkipped.length;
    setAddMessage(
      added > 0
        ? `Added ${added} channel${added === 1 ? '' : 's'}${skipped ? ` (${skipped} skipped as duplicates)` : ''}.`
        : 'No new channels were added.',
    );
    setSelected(new Set());
  }

  async function handleAddOne(airport: AirportListing) {
    setAdding(true);
    setAddMessage(null);
    try {
      await persistAirports([airport]);
    } finally {
      setAdding(false);
    }
  }

  async function handleAddSelected() {
    const airports = search.airports.filter((airport) => selected.has(airportListingKey(airport)));
    if (airports.length === 0) return;
    setAdding(true);
    setAddMessage(null);
    try {
      await persistAirports(airports);
    } finally {
      setAdding(false);
    }
  }

  async function handleUseMyLocation(lat: number, lon: number) {
    await search.search('', { lat, lon });
  }

  return (
    <FormPage
      title="Add airband from OpenAIP"
      description="Search OpenAIP for airport frequencies and import RX-only AM channels into your library."
      footer={
        <Button variant="light" component={Link} to="/library/channels">
          Back to library
        </Button>
      }
    >
      <PageSection title="Search" description="Query OpenAIP by location or airport identifier.">
        <Stack gap="sm">
          {!search.hasApiKey ? (
            <Alert color="yellow">
              OpenAIP API key required.{' '}
              <Anchor
                component={Link}
                to="/settings"
                state={{ scrollTo: SETTINGS_OPENAIP_SECTION_ID }}
              >
                Add your key in Settings
              </Anchor>
              .
            </Alert>
          ) : null}

          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="ICAO, IATA, airport name, locator, or town"
              value={search.query}
              onChange={(e) => search.setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search.search();
              }}
              style={{ flex: 1, minWidth: 220 }}
            />
            <NumberInput
              label="Radius (km)"
              value={search.radiusKm}
              onChange={(value) => search.setRadiusKm(typeof value === 'number' ? value : 50)}
              min={1}
              max={500}
              style={{ width: 120 }}
            />
            <Checkbox
              label="Create zone per airport"
              checked={search.alsoCreateZone}
              onChange={(e) => search.setAlsoCreateZone(e.currentTarget.checked)}
              mt={24}
            />
            <UseMyLocationButton onLocation={(lat, lon) => void handleUseMyLocation(lat, lon)} />
            <Button
              leftSection={<IconSearch size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
              onClick={() => void search.search()}
              loading={search.loading}
              disabled={!search.hasApiKey}
            >
              Search
            </Button>
          </Group>

          {kindHint && !search.error ? (
            <Text size="sm" c="dimmed">
              {kindHint}
            </Text>
          ) : null}

          {search.error ? <Alert color="red">{search.error}</Alert> : null}
          {addMessage ? <Alert color="green">{addMessage}</Alert> : null}
        </Stack>
      </PageSection>

      {search.airports.length > 0 ? (
        <PageSection title="Results">
          <Stack gap="md">
            {mapChannels.length > 0 ? (
              <CodeplugMap channels={mapChannels} zones={[]} allChannels={mapChannels} height={360} />
            ) : (
              <Text size="sm" c="dimmed">
                No geolocated airports to plot on the map.
              </Text>
            )}

            <Group justify="space-between">
              <Checkbox
                label="Select all"
                checked={
                  search.airports.length > 0 &&
                  search.airports.every((airport) => selected.has(airportListingKey(airport)))
                }
                indeterminate={selected.size > 0 && selected.size < search.airports.length}
                onChange={(e) => toggleAll(e.currentTarget.checked)}
              />
              <Button
                disabled={selected.size === 0}
                loading={adding}
                onClick={() => void handleAddSelected()}
              >
                Add selected ({selected.size})
              </Button>
            </Group>

            <ScrollArea.Autosize mah={720}>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                {search.airports.map((airport) => {
                  const key = airportListingKey(airport);
                  return (
                    <AirportCard
                      key={key}
                      airport={airport}
                      referencePoint={search.referencePoint}
                      selected={selected.has(key)}
                      onToggle={(checked) => toggleRow(key, checked)}
                      onAdd={() => void handleAddOne(airport)}
                      adding={adding}
                    />
                  );
                })}
              </SimpleGrid>
            </ScrollArea.Autosize>
          </Stack>
        </PageSection>
      ) : null}

      <Text size="xs" c="dimmed" mt="md">
        Airport data ©{' '}
        <Anchor href="https://www.openaip.net/" target="_blank" rel="noreferrer">
          OpenAIP
        </Anchor>{' '}
        contributors. Frequencies may change with AIP amendments — RX monitoring only; not
        authoritative for aviation operations.{' '}
        <Anchor component={Link} to="/attributions" size="xs">
          Attributions
        </Anchor>
      </Text>
    </FormPage>
  );
}
