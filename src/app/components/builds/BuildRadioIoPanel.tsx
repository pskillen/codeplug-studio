/**
 * Web Serial connect / write (assemble → overlay this PROGRAM session → radio)
 * for egress pathways with a registered radio adapter. Write runs in the Write stepper (#1393).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Anchor, Button, Stack, Text } from '@mantine/core';
import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
  isMm9pdyDm32RadioIoProfileId,
  isRt95RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
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
import { atD890OverrideCount, useAtD890RadioSettingsSession } from '../../state/atD890RadioSettingsSession.ts';
import AtD890WriteCoverageTable from './AtD890WriteCoverageTable.tsx';
import { DM32_ANALOG_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
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
  const isAtD890Write = isAtD890RadioIoProfileId(egress.profileId);
  const isRt95Write = isRt95RadioIoProfileId(egress.profileId);

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

  const isMm9pdyTarget =
    isMm9pdyAtD890RadioIoProfileId(egress.profileId) ||
    isMm9pdyDm32RadioIoProfileId(egress.profileId);
  const radioLabel = `${descriptor?.label ?? 'radio'}${isMm9pdyTarget ? ' (MM9PDY)' : ''}`;

  async function handleAssignMm9pdyStepKeys(checked: boolean) {
    const next = buildService.withExportSettings(build, { assignMm9pdyStepKeys: checked });
    const result = await buildService.putBuild(next, build.revision);
    if (!result.ok) {
      setError(
        result.reason === 'revision_conflict'
          ? 'Build changed elsewhere — reload and try again.'
          : 'Could not save the TG step-key setting.',
      );
    }
  }

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
      {isAtD890Write ? <RangeChangeBanner buildId={build.id} /> : null}
      <WriteHeaderCard
        radioLabel={radioLabel}
        summary={
          facts
            ? buildSummaryLine({
                channels: facts.channelCount,
                zones: facts.zoneCount,
                ...(isAtD890Write
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
        txRangeInfo={isAtD890Write}
      />
      {isAtD890Write ? <AtD890RadioSettingsCard buildId={build.id} egress={egress} /> : null}
      {isRt95Write ? <Rt95RadioSettingsCard buildId={build.id} egress={egress} /> : null}
      {descriptorSupportsBackup(descriptor) ? <RadioBackupCard buildId={build.id} /> : null}
      {isAtD890Write ? (
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
              mm9pdy={isMm9pdyAtD890RadioIoProfileId(egress.profileId)}
              hasDefaultDmrId={facts?.hasDefaultDmrId ?? false}
              hasDefaultNxdnId={facts?.hasDefaultNxdnId ?? false}
            />
          ) : null}
        </div>
      ) : null}
      {isAtD890Write && listOfferedDangerZoneTools(build.radioTargetId).length > 0 ? (
        <DangerZoneCard buildId={build.id} />
      ) : null}
      <ExperimentalNote
        details={
          isAtD890Write
            ? 'Write assembles modelled channels and organisation from the build, then reads co-resident bytes from the connected radio during upload. Unmodelled settings are preserved via erase-unit read-modify-write — not from a stored project image. Use Backup / Restore for a zip snapshot and ephemeral inspection.'
            : 'Write overlays modelled channels and organisation onto an in-session read of the connected radio. Unmodelled settings are preserved from that live FLASH image — not from a stored project clone. Identity is the radio on the cable this session, not a saved stash. Use Backup / Restore for a zip snapshot.'
        }
      />
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
      {isDm32RadioIoProfileId(egress.profileId) ? (
        <Text size="xs" c="dimmed">
          {DM32_ANALOG_CONTACTS_WRITE_GAP}
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}
