/**
 * Web Serial connect / write (assemble → overlay this PROGRAM session → radio)
 * for egress pathways with a registered radio adapter. Write runs in the Write stepper (#1393).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Button, Stack, Text } from '@mantine/core';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { findAttribution } from '../../lib/attributions.ts';
import { loadLibrarySlice } from '../../lib/loadLibrarySlice.ts';
import { useUnsavedNavigationGuard } from '../../hooks/useUnsavedNavigationGuard.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useProjects } from '../../state/useProjects.ts';
import {
  buildHasRadioCloneHydration,
  descriptorsForEgress,
  getRadioCloneHydration,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
} from '../../services/radioIoSession.ts';
import {
  buildSummaryLine,
  radioIoPanelFacts,
  type RadioIoPanelFacts,
} from '../../services/radioIoPanelFacts.ts';
import { descriptorSupportsBackup } from '../../services/radioBackupRestore.ts';
import WriteHeaderCard from './RadioIoPanelCards/WriteHeaderCard.tsx';
import BeforeYouWriteRows from './RadioIoPanelCards/BeforeYouWriteRows.tsx';
import AtD890RadioSettingsCard from './RadioIoPanelCards/AtD890RadioSettingsCard.tsx';
import Rt95RadioSettingsCard from './RadioIoPanelCards/Rt95RadioSettingsCard.tsx';
import RadioBackupCard from './RadioIoPanelCards/RadioBackupCard.tsx';
import ExperimentalNote from './RadioIoPanelCards/ExperimentalNote.tsx';
import RangeChangeBanner from '../dangerZone/RangeChangeBanner.tsx';
import DangerZoneCard from './RadioIoPanelCards/DangerZoneCard.tsx';
import { listOfferedDangerZoneTools } from '../../services/dangerZone/gate.ts';
import {
  atD890OverrideCount,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import AtD890WriteCoverageTable from './AtD890WriteCoverageTable.tsx';
import {
  experimentalDetailsFor,
  resolveRadioIoPanelExtras,
} from '../../services/egress/radioIoPanelExtras.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from '../../services/radioWriteEnvGate.ts';
import { useRadioWriteDialog } from './RadioWriteDialog/useRadioWriteDialog.tsx';

export interface BuildRadioIoPanelProps {
  build: RadioBuild;
  /** Web Serial pathway carrying format/profile/hydration (#654). */
  egress: EgressPath;
}

const buildService = new BuildService(persistence);

export default function BuildRadioIoPanel({ build, egress }: BuildRadioIoPanelProps) {
  const descriptors = descriptorsForEgress(egress);
  const { activeProjectId } = useProjects();
  const { reloadEgressPaths } = useBuildLayout();

  const [error, setError] = useState<string | null>(null);
  const [facts, setFacts] = useState<RadioIoPanelFacts | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const navigate = useNavigate();

  const serialOk = isRadioSerialSupported();
  const descriptor = descriptors[0];
  const writeGate = resolveRadioWriteGate(descriptor, undefined, egress.profileId);
  const writeHidden = writeGate === 'hidden';
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  const panelExtras = resolveRadioIoPanelExtras(
    egress.profileId,
    listOfferedDangerZoneTools(build.radioTargetId).length,
  );

  const writeDialog = useRadioWriteDialog({
    build,
    egress,
    onOpenSettingsPage: () => navigate(`/builds/${build.id}/export/radio-settings`),
  });
  const d890SettingsSession = useAtD890RadioSettingsSession(build.id);

  // Counts and receive-range rows for the header and Before you write. Informational only.
  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void (async () => {
      try {
        const library = await loadLibrarySlice(persistence, activeProjectId);
        if (!cancelled) setFacts(radioIoPanelFacts(build, egress, library));
      } catch {
        if (!cancelled) setFacts(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, build, egress]);

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(writeDialog.busy);

  useEffect(() => {
    if (leaveAttempted) stay();
  }, [leaveAttempted, stay]);

  const attributionNames = (descriptor?.attributionIds ?? [])
    .map((id) => findAttribution(id)?.name)
    .filter(Boolean)
    .join(' / ');

  if (descriptors.length === 0) return null;

  const radioLabel = `${descriptor?.label ?? 'radio'}${panelExtras.radioLabelSuffix}`;

  function openWriteRadio() {
    setError(null);
    writeDialog.open();
  }

  async function handleClearHydration() {
    if (!hasHydration) return;
    const next = buildService.clearEgressHydration(egress);
    const saved = await buildService.putEgressPath(next, egress.revision);
    if (!saved.ok) {
      setError('Could not clear stored radio image.');
      return;
    }
    await reloadEgressPaths();
  }

  return (
    <Stack gap="sm">
      {writeDialog.element}
      {panelExtras.rangeChangeBanner ? <RangeChangeBanner buildId={build.id} /> : null}
      <WriteHeaderCard
        radioLabel={radioLabel}
        summary={
          facts
            ? buildSummaryLine({
                channels: facts.channelCount,
                zones: facts.zoneCount,
                ...(panelExtras.summaryIncludesSettingChanges
                  ? { settingChanges: atD890OverrideCount(d890SettingsSession.overrides) }
                  : {}),
              })
            : undefined
        }
        writeHidden={writeHidden}
        disabled={!serialOk || writeDialog.busy}
        onWrite={openWriteRadio}
      />
      {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
      <BeforeYouWriteRows
        radioLabel={descriptor?.label ?? 'radio'}
        outOfRangeChannels={facts?.outOfRangeChannels ?? []}
        txRangeInfo={panelExtras.beforeYouWriteTxRangeInfo}
      />
      {panelExtras.atD890RadioSettings ? (
        <AtD890RadioSettingsCard buildId={build.id} egress={egress} />
      ) : null}
      {panelExtras.rt95RadioSettings ? (
        <Rt95RadioSettingsCard buildId={build.id} egress={egress} />
      ) : null}
      {descriptorSupportsBackup(descriptor) ? <RadioBackupCard buildId={build.id} /> : null}
      {panelExtras.writeCoverageTable ? (
        <div>
          <Button
            size="xs"
            variant="subtle"
            aria-expanded={coverageOpen}
            onClick={() => setCoverageOpen((v) => !v)}
          >
            {coverageOpen ? 'Hide what Write updates' : 'What Write updates'}
          </Button>
          {coverageOpen ? (
            <AtD890WriteCoverageTable
              settingsChangeCount={atD890OverrideCount(d890SettingsSession.overrides)}
              buildId={build.id}
              hasHydration={hasHydration}
              mm9pdy={panelExtras.writeCoverageMm9pdy}
              hasDefaultDmrId={facts?.hasDefaultDmrId ?? false}
              hasDefaultNxdnId={facts?.hasDefaultNxdnId ?? false}
            />
          ) : null}
        </div>
      ) : null}
      {panelExtras.dangerZoneCard ? <DangerZoneCard buildId={build.id} /> : null}
      <ExperimentalNote details={experimentalDetailsFor(panelExtras.experimentalCopy)} />
      {attributionNames ? (
        <Text size="xs" c="dimmed">
          Protocol lineage thanks to {attributionNames}. See{' '}
          <Anchor href="/attributions" size="xs">
            Attributions
          </Anchor>
          .
        </Text>
      ) : null}
      {hasHydration && hydration ? (
        <Alert color="gray" title="Stored radio image (unused for Write)">
          <Text size="sm">
            Model {hydration.retain.radioModelId}
            {hydration.retain.firmware ? ` · firmware ${hydration.retain.firmware}` : ''}
            {' · '}
            {hydration.retain.imageByteLength} bytes
            {hydration.capturedAt
              ? ` · captured ${new Date(hydration.capturedAt).toLocaleString()}`
              : ''}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            This leftover clone is not a Write input. Snapshot and inspect on{' '}
            <Anchor component={Link} to={`/builds/${build.id}/backup`} size="xs">
              Backup / Restore
            </Anchor>
            .
          </Text>
          <Button size="xs" variant="subtle" mt="xs" onClick={() => void handleClearHydration()}>
            Clear stored image
          </Button>
        </Alert>
      ) : writeHidden ? (
        <Text size="xs" c="dimmed">
          {resolveRadioWriteProdDisabledMessage(egress.profileId)}
        </Text>
      ) : null}
      {panelExtras.dm32AnalogContactsNote ? (
        <Text size="xs" c="dimmed">
          {panelExtras.dm32AnalogContactsNote}
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}
