import { useState } from 'react';
import { NumberInput, Stack, Table, Text, TextInput } from '@mantine/core';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { BAND_PLAN, bandLabelForFrequencyHz } from '@core/domain/bandPlan.ts';
import { mhzStringToHz } from '../lib/units.ts';
import { FormSection, ListPage, PageSection } from '../components/ui/index.ts';

export default function ReferencePage() {
  return (
    <ListPage
      title="Reference"
      description="Amateur radio helpers for programming convenience — not authoritative for on-air operation."
    >
      <MaidenheadConverter />
      <FrequencyLookup />
      <BandPlanTable />
    </ListPage>
  );
}

function MaidenheadConverter() {
  const [locator, setLocator] = useState('IO91');
  const [lat, setLat] = useState('51.5');
  const [lon, setLon] = useState('-0.1');

  const coords = isValidLocator(locator) ? locatorToCoords(locator) : null;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const derivedLocator =
    Number.isFinite(latNum) && Number.isFinite(lonNum) ? coordsToLocator(latNum, lonNum, 6) : null;

  return (
    <PageSection id="reference-maidenhead" title="Maidenhead locator">
      <Stack gap="lg">
        <FormSection title="Locator → coordinates">
          <TextInput
            label="Locator"
            value={locator}
            onChange={(e) => setLocator(e.currentTarget.value)}
          />
          <Text size="sm" c={coords ? undefined : 'red'}>
            {coords
              ? `Lat ${coords.lat.toFixed(4)}, Lon ${coords.lon.toFixed(4)}`
              : 'Enter a valid locator (e.g. IO91, IO91wm).'}
          </Text>
        </FormSection>
        <FormSection title="Coordinates → locator">
          <Stack gap="xs">
            <NumberInput label="Latitude" value={lat} onChange={(v) => setLat(String(v))} />
            <NumberInput label="Longitude" value={lon} onChange={(v) => setLon(String(v))} />
          </Stack>
          <Text size="sm">{derivedLocator ? `Locator ${derivedLocator}` : '—'}</Text>
        </FormSection>
      </Stack>
    </PageSection>
  );
}

function FrequencyLookup() {
  const [mhz, setMhz] = useState('145.5');
  const hz = mhzStringToHz(mhz);
  const band = bandLabelForFrequencyHz(hz);
  return (
    <PageSection id="reference-frequency" title="Frequency → band">
      <TextInput
        label="Frequency (MHz)"
        value={mhz}
        onChange={(e) => setMhz(e.currentTarget.value)}
      />
      <Text size="sm" mt="sm">
        Band: <strong>{band}</strong>
      </Text>
    </PageSection>
  );
}

function BandPlanTable() {
  return (
    <PageSection id="reference-band-plan" title="Band plan">
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Band</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Range (MHz)</Table.Th>
            <Table.Th>Service</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {BAND_PLAN.map((b) => (
            <Table.Tr key={b.label}>
              <Table.Td fw={600}>{b.label}</Table.Td>
              <Table.Td>{b.name}</Table.Td>
              <Table.Td>
                {(b.startHz / 1_000_000).toFixed(3)}–{(b.endHz / 1_000_000).toFixed(3)}
              </Table.Td>
              <Table.Td>{b.service}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Text size="xs" c="dimmed" mt="sm">
        For programming convenience only. Not authoritative for on-air operation.
      </Text>
    </PageSection>
  );
}
