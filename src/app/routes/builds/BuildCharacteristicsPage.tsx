import { Link } from 'react-router-dom';
import { List, Stack, Table, Text, Title } from '@mantine/core';
import type { FormatId } from '@core/import-export/types.ts';
import {
  getProfileExportLimits,
  type ExportLimitValue,
  type ProfileExportLimits,
} from '@core/import-export/profileExportLimits.ts';
import type { PowerLadderEntry } from '@core/import-export/profileLadder.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import {
  BuildCapabilityTrait,
  traitProfileFor,
  type BuildCapabilityTrait as CapabilityId,
} from '@core/models/traits.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import {
  BUILD_ORGANISATION_INTRO,
  capabilityCopyFor,
  conceptsForCapabilities,
} from '../../lib/buildCapabilityCopy.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';

interface LimitRow {
  label: string;
  value: ExportLimitValue;
}

function formatLimitValue(value: ExportLimitValue): string {
  if (value === 'not_used') return 'Not used';
  if (value === null) return '—';
  return String(value);
}

function limitRows(limits: ProfileExportLimits): LimitRow[] {
  const rows: LimitRow[] = [
    { label: 'Max channels / memories', value: limits.maxChannels },
    { label: 'Max zones', value: limits.maxZones },
    { label: 'Max scan lists', value: limits.maxScanLists },
    { label: 'Max RX group lists', value: limits.maxRxGroupLists },
    { label: 'Max contacts', value: limits.maxContacts },
    { label: 'Max talk groups', value: limits.maxTalkGroups },
    { label: 'Max members per zone', value: limits.zoneMembers },
    { label: 'Max members per scan list', value: limits.scanListMembers },
    { label: 'Max members per RX group list', value: limits.rxGroupListMembers },
    { label: 'Name length — channel', value: limits.nameLengthChannel },
    { label: 'Name length — zone', value: limits.nameLengthZone },
    { label: 'Name length — contact', value: limits.nameLengthContact },
    { label: 'Name length — talk group', value: limits.nameLengthTalkGroup },
    { label: 'Name length — scan list', value: limits.nameLengthScanList },
    { label: 'Name length — RX group list', value: limits.nameLengthRxGroupList },
  ];
  return rows.filter((row) => row.value !== 'not_used');
}

function ladderLine(entry: PowerLadderEntry): string {
  const watts = entry.approxWatts ? ` ≈ ${entry.approxWatts}` : '';
  return `${entry.wire}${watts} (${entry.percent}%)`;
}

export default function BuildCharacteristicsPage() {
  const { build } = useBuildLayout();
  const formatId = build.formatId as FormatId;
  const formatEntry = formatCatalogEntry(formatId);
  const traitProfile = traitProfileFor(build.profileId);
  const traits = (traitProfile?.traits ?? []) as CapabilityId[];
  const limits = getProfileExportLimits(formatId, build.profileId);
  const concepts = conceptsForCapabilities(traits, formatId);
  const shownLimits = limits ? limitRows(limits) : [];

  return (
    <FormPage
      title="Radio characteristics"
      description={
        <Text size="sm" component="span">
          Read-only facts for{' '}
          <Text span fw={600}>
            {formatEntry?.label ?? build.formatId}
          </Text>
          {limits ? (
            <>
              {' · '}
              <Text span fw={600}>
                {limits.profileLabel}
              </Text>
            </>
          ) : null}
          . Change the radio profile on <Link to={`/builds/${build.id}/overview`}>Setup</Link>.
        </Text>
      }
    >
      <Stack gap="lg">
        <FormSection title="How this radio is organised" description={BUILD_ORGANISATION_INTRO}>
          {traits.length === 0 ? (
            <Text size="sm" c="dimmed">
              No organisation details are recorded for this profile yet.
            </Text>
          ) : (
            <Stack gap="md">
              {traits.map((trait) => {
                const copy = capabilityCopyFor(trait);
                const note = copy.formatNotes?.[formatId];
                return (
                  <Stack key={trait} gap={4}>
                    <Title order={5}>{copy.label}</Title>
                    <Text size="sm">{copy.summary}</Text>
                    {note ? (
                      <Text size="sm" c="dimmed">
                        {note}
                      </Text>
                    ) : null}
                    <List size="sm" spacing={2}>
                      {copy.consequences.map((item) => (
                        <List.Item key={item}>{item}</List.Item>
                      ))}
                    </List>
                  </Stack>
                );
              })}
            </Stack>
          )}
        </FormSection>

        <FormSection
          title="Export limits"
          description="Caps the exporter enforces for this profile. A dash means we have not recorded a figure yet — it is not a promise that the radio is unlimited."
        >
          {!limits || shownLimits.length === 0 ? (
            <Text size="sm" c="dimmed">
              No export limits are available for this profile.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={360}>
              <Table withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Limit</Table.Th>
                    <Table.Th>Value</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shownLimits.map((row) => (
                    <Table.Tr key={row.label}>
                      <Table.Td>{row.label}</Table.Td>
                      <Table.Td>{formatLimitValue(row.value)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </FormSection>

        <FormSection
          title="Power levels"
          description="How library power (percent) maps when exporting to this profile. Radio default (no fixed level) usually exports as the highest step."
        >
          {!limits || limits.powerLadder.length === 0 ? (
            <Text size="sm" c="dimmed">
              No power ladder is recorded for this profile.
            </Text>
          ) : (
            <List size="sm" spacing={2}>
              {limits.powerLadder.map((entry) => (
                <List.Item key={`${entry.wire}-${entry.percent}`}>{ladderLine(entry)}</List.Item>
              ))}
            </List>
          )}
        </FormSection>

        {limits && limits.siblingLadders.length > 0
          ? limits.siblingLadders.map((ladder) => (
              <FormSection
                key={ladder.label}
                title={ladder.label}
                description={`Steps this profile uses for ${ladder.label.toLowerCase()} on export.`}
              >
                <List size="sm" spacing={2}>
                  {ladder.entries.map((entry) => (
                    <List.Item key={`${ladder.label}-${entry.wire}-${entry.percent}`}>
                      {ladderLine(entry)}
                    </List.Item>
                  ))}
                </List>
              </FormSection>
            ))
          : null}

        {concepts.length > 0 ? (
          <FormSection title="Other concepts for this target">
            <Stack gap="md">
              {concepts.map((concept) => (
                <Stack key={concept.id} gap={4}>
                  <Title order={5}>{concept.title}</Title>
                  <Text size="sm">{concept.body}</Text>
                </Stack>
              ))}
            </Stack>
          </FormSection>
        ) : null}

        {traits.includes(BuildCapabilityTrait.ZoneGrouping) ||
        traits.includes(BuildCapabilityTrait.DedicatedScanLists) ||
        traits.includes(BuildCapabilityTrait.MxNChannelExpansion) ? (
          <Text size="sm" c="dimmed">
            Wire-column detail for this CPS family lives in the format reference under Help / docs —
            this page stays at operator limits and organisation, not CSV headers.
          </Text>
        ) : null}
      </Stack>
    </FormPage>
  );
}
