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
  type BuildCapabilityTrait as CapabilityId,
} from '@core/models/traits.ts';
import { traitsForRadioTarget } from '@core/radio-targets/index.ts';
import { egressIdentityForBuild } from '../../lib/buildEgressUi.ts';
import {
  BUILD_ORGANISATION_INTRO,
  capabilityCopyFor,
  conceptsForCapabilities,
} from '../../lib/buildCapabilityCopy.ts';
import RadioRfCapabilitiesSection from '../../components/builds/RadioRfCapabilitiesSection.tsx';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildSubPage.module.css';

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
  const { build, activeEgress } = useBuildLayout();
  const { formatId, profileId } = egressIdentityForBuild(build, activeEgress);
  const formatEntry = formatCatalogEntry(formatId as FormatId);
  const traits = traitsForRadioTarget(build.radioTargetId) as CapabilityId[];
  const limits = getProfileExportLimits(formatId as FormatId, profileId);
  const concepts = conceptsForCapabilities(traits, formatId as FormatId);
  const shownLimits = limits ? limitRows(limits) : [];

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Radio characteristics</h1>
        <p className={classes.subtitle}>
          Read-only facts for <strong>{formatEntry?.label ?? formatId}</strong>
          {limits ? (
            <>
              {' · '}
              <strong>{limits.profileLabel}</strong>
            </>
          ) : null}
          . Limits follow the active export pathway — switch it on{' '}
          <Link to={`/builds/${build.id}/export`}>Export</Link>.
        </p>
      </div>
      <Stack gap="lg">
        <section className={classes.panel}>
          <h2 className={classes.panelTitle}>How this radio is organised</h2>
          <p className={classes.panelHint}>{BUILD_ORGANISATION_INTRO}</p>
          {traits.length === 0 ? (
            <Text size="sm" c="dimmed">
              No organisation details are recorded for this profile yet.
            </Text>
          ) : (
            <Stack gap="md">
              {traits.map((trait) => {
                const copy = capabilityCopyFor(trait);
                const note = copy.formatNotes?.[formatId as FormatId];
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
        </section>

        <RadioRfCapabilitiesSection radioTargetId={build.radioTargetId} />

        <section className={classes.panel}>
          <h2 className={classes.panelTitle}>Export limits</h2>
          <p className={classes.panelHint}>
            Caps the exporter enforces for this profile. A dash means we have not recorded a figure
            yet — it is not a promise that the radio is unlimited.
          </p>
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
        </section>

        <section className={classes.panel}>
          <h2 className={classes.panelTitle}>Power levels</h2>
          <p className={classes.panelHint}>
            How library power (percent) maps when exporting to this profile. Radio default (no fixed
            level) usually exports as the highest step.
          </p>
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
        </section>

        {limits && limits.siblingLadders.length > 0
          ? limits.siblingLadders.map((ladder) => (
              <section key={ladder.label} className={classes.panel}>
                <h2 className={classes.panelTitle}>{ladder.label}</h2>
                <p className={classes.panelHint}>
                  Steps this profile uses for {ladder.label.toLowerCase()} on export.
                </p>
                <List size="sm" spacing={2}>
                  {ladder.entries.map((entry) => (
                    <List.Item key={`${ladder.label}-${entry.wire}-${entry.percent}`}>
                      {ladderLine(entry)}
                    </List.Item>
                  ))}
                </List>
              </section>
            ))
          : null}

        {concepts.length > 0 ? (
          <section className={classes.panel}>
            <h2 className={classes.panelTitle}>Other concepts for this target</h2>
            <Stack gap="md">
              {concepts.map((concept) => (
                <Stack key={concept.id} gap={4}>
                  <Title order={5}>{concept.title}</Title>
                  <Text size="sm">{concept.body}</Text>
                </Stack>
              ))}
            </Stack>
          </section>
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
    </div>
  );
}
