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
} from '@core/import-export/formatProfiles.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import {
  ModalShell,
  WriteVerifyReport as WriteVerifyReportV2,
  Button as V2Button,
  ConfirmModal,
} from '../v2/index.ts';
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
  channelLocationNoteForWrite,
  descriptorsForEgress,
  getRadioCloneHydration,
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
} from '../../services/radioIoSession.ts';
import { hasPersistedStepKeySwitch, mm9pdyStepKeysDescription } from './mm9pdyStepKeysCopy.ts';
import {
  buildSummaryLine,
  radioIoPanelFacts,
  type RadioIoPanelFacts,
} from '../../services/radioIoPanelFacts.ts';
import { descriptorSupportsBackup } from '../../services/radioBackupRestore.ts';
import WriteHeaderCard from './RadioIoPanelCards/WriteHeaderCard.tsx';
import BeforeYouWriteRows from './RadioIoPanelCards/BeforeYouWriteRows.tsx';
import AtD890RadioSettingsCard from './RadioIoPanelCards/AtD890RadioSettingsCard.tsx';
import RadioBackupCard from './RadioIoPanelCards/RadioBackupCard.tsx';
import ExperimentalNote from './RadioIoPanelCards/ExperimentalNote.tsx';
import RangeChangeBanner from '../dangerZone/RangeChangeBanner.tsx';
import DangerZoneCard from './RadioIoPanelCards/DangerZoneCard.tsx';
import { listOfferedDangerZoneTools } from '../../services/dangerZone/gate.ts';
import {
  atD890OverrideCount,
  overridesForWrite,
  setApplyToEveryRadio,
  setWriteSettingsRequested,
  useAtD890RadioSettingsSession,
} from '../../state/atD890RadioSettingsSession.ts';
import { atD890OverrideWords } from './RadioWriteStepper/d890/atD890ReviewFacts.ts';
import WriteVerifyReport from './WriteVerifyReport.tsx';
import { mapWriteVerifyResultToV2Report } from './writeVerifyReportV2Adapter.ts';
import AtD890WriteCoverageTable from './AtD890WriteCoverageTable.tsx';
import {
  DM32_ANALOG_CONTACTS_WRITE_GAP,
  DM32_POWER_CYCLE_AFTER_SESSION_NOTE,
} from '@integrations/radio-io/radios/dm32uv/writeRole.ts';
import { AT_D890_DIGITAL_CONTACTS_WRITE_GAP } from '@integrations/radio-io/radios/at-d890uv/writeRole.ts';
import {
  resolveRadioWriteGate,
  resolveRadioWriteProdDisabledMessage,
} from '../../services/radioWriteEnvGate.ts';
import { isOpenGd77RadioIoEgress } from '../../services/radioIoChannelMap.ts';
import {
  getSatelliteKepsWriteAdapter,
  hasSatelliteKepsWriteAdapter,
  satelliteKepsSameSessionAfterUpload,
} from '../../services/satelliteKepsWriteAdapters.ts';
import RadioWriteStepper from './RadioWriteStepper/RadioWriteStepper.tsx';
import { useRadioWriteFlow } from './RadioWriteStepper/useRadioWriteFlow.tsx';
import { RADIO_RESTART_WAIT_SECONDS } from './RadioWriteStepper/useRadioWriteFlow.tsx';
import type { WriteStepperConfig } from './RadioWriteStepper/types.ts';

export interface BuildRadioIoPanelProps {
  build: RadioBuild;
  /** Web Serial pathway carrying format/profile/hydration (#654). */
  egress: EgressPath;
}

const buildService = new BuildService(persistence);

export default function BuildRadioIoPanel({ build, egress }: BuildRadioIoPanelProps) {
  const descriptors = descriptorsForEgress(egress);
  const { activeProjectId, activeProject } = useProjects();
  const { reloadEgressPaths } = useBuildLayout();

  const [error, setError] = useState<string | null>(null);
  const [verifyReportOpen, setVerifyReportOpen] = useState(false);
  const [channelLocationNote, setChannelLocationNote] = useState<string | null>(null);
  const [kepsCount, setKepsCount] = useState<number | null>(null);
  const [facts, setFacts] = useState<RadioIoPanelFacts | null>(null);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const navigate = useNavigate();

  const serialOk = isRadioSerialSupported();
  const descriptor = descriptors[0];
  const writeVerifyHooks = descriptor?.writeVerify;
  const writeGate = resolveRadioWriteGate(descriptor);
  const writeHidden = writeGate === 'hidden';
  const hydration = getRadioCloneHydration(egress);
  const hasHydration = buildHasRadioCloneHydration(egress);
  const isAtD890Write = isAtD890RadioIoProfileId(egress.profileId);
  const supportsKepsWrite = hasSatelliteKepsWriteAdapter(egress.profileId);
  const kepsWriteFn = getSatelliteKepsWriteAdapter(egress.profileId);
  const dualBankTraitProfile = traitProfileFor(egress.profileId);
  const supportsDualBankWrite = Boolean(
    dualBankTraitProfile?.traits.includes(BuildCapabilityTrait.SeparateDigitalIdList),
  );
  const supportsSingleBankWrite = isAtD890Write && !supportsDualBankWrite;
  const supportsDigitalContacts = supportsDualBankWrite || supportsSingleBankWrite;

  const flow = useRadioWriteFlow({
    build,
    egress,
    descriptor,
    activeProjectId,
    supportsDualBankWrite,
    supportsSingleBankWrite,
    kepsWriteFn,
    kepsSameSessionAfterUpload: satelliteKepsSameSessionAfterUpload(egress.profileId),
    onOpenSettingsPage: () => navigate(`/builds/${build.id}/export/radio-settings`),
  });
  const { view: flowView, actions: flowActions } = flow;
  const settingsSession = useAtD890RadioSettingsSession(build.id);
  const openFlow = flow.open;
  const writeSettingsRequested = isAtD890Write && settingsSession.writeSettingsRequested;

  // The settings page's "Write settings…" lands here and opens the stepper with only Radio settings ticked.
  useEffect(() => {
    if (!writeSettingsRequested) return;
    setWriteSettingsRequested(build.id, false);
    openFlow({ codeplug: false, contacts: false, keps: false, settings: true });
  }, [writeSettingsRequested, build.id, openFlow]);

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

  const { modalOpen: leaveAttempted, stay } = useUnsavedNavigationGuard(flowView.busy);

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
    setChannelLocationNote(null);
    setKepsCount(null);
    flow.open();
    void loadChannelLocationNote();
    void loadKepsCount();
  }

  async function loadChannelLocationNote() {
    if (!activeProjectId) return;
    try {
      const library = await loadLibrarySlice(persistence, activeProjectId);
      setChannelLocationNote(channelLocationNoteForWrite(build, egress, library));
    } catch {
      // Informational only — Write still works without the note.
      setChannelLocationNote(null);
    }
  }

  async function loadKepsCount() {
    if (!activeProjectId || !supportsKepsWrite) return;
    try {
      const all = await persistence.listSatellites(activeProjectId);
      setKepsCount(all.filter((s) => s.enabled).length);
    } catch {
      setKepsCount(null);
    }
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

  const stepperConfig: WriteStepperConfig = {
    radioLabel: descriptor?.label ?? 'radio',
    buildId: build.id,
    serialOk,
    writeHidden,
    support: {
      contacts: supportsDigitalContacts,
      keps: supportsKepsWrite,
      settings: isAtD890Write,
    },
    sharedContactBankNote: isOpenGd77RadioIoEgress(egress.profileId),
    sharedAddressBookNote: isDm32RadioIoProfileId(egress.profileId),
    kepsSummary:
      kepsCount != null
        ? `${kepsCount} ${kepsCount === 1 ? 'satellite' : 'satellites'}`
        : undefined,
    kepsLastUpdatedIso: activeProject?.satelliteLibraryLastUpdated,
    channelLocationNote,
    ...(isAtD890Write
      ? {
          radioSettings: {
            count: atD890OverrideCount(settingsSession.overrides),
            words: atD890OverrideWords(
              overridesForWrite(build.id),
              isMm9pdyAtD890RadioIoProfileId(egress.profileId) ? 'mm9pdy' : 'stock',
            ),
            applyToEveryRadio: settingsSession.applyToEveryRadio,
            onApplyToEveryRadioChange: (checked: boolean) =>
              setApplyToEveryRadio(build.id, checked),
          },
        }
      : {}),
    ...(hasPersistedStepKeySwitch(build.radioTargetId)
      ? {
          stepKeys: {
            checked: build.exportSettings?.assignMm9pdyStepKeys === true,
            description: mm9pdyStepKeysDescription(build.radioTargetId),
            onChange: (checked: boolean) => void handleAssignMm9pdyStepKeys(checked),
          },
        }
      : {}),
    restartWaitSeconds: RADIO_RESTART_WAIT_SECONDS,
    cancelRestartsRadio: writeVerifyHooks?.requiresCrossSessionReconnect === true,
    supportsCheck: Boolean(writeVerifyHooks),
    successNote: isDm32RadioIoProfileId(egress.profileId)
      ? DM32_POWER_CYCLE_AFTER_SESSION_NOTE
      : undefined,
  };
  const checkResult = flow.checkResult;

  return (
    <Stack gap="sm">
      <ModalShell
        open={verifyReportOpen && checkResult !== null}
        onClose={() => setVerifyReportOpen(false)}
        title="Write verify report"
        size="lg"
        footer={
          <V2Button variant="primary" size="sm" onClick={() => setVerifyReportOpen(false)}>
            Close
          </V2Button>
        }
      >
        {checkResult ? (
          <Stack gap="md">
            <WriteVerifyReportV2
              title="Verify results"
              {...mapWriteVerifyResultToV2Report(checkResult)}
            />
            {writeVerifyHooks ? (
              <WriteVerifyReport
                result={checkResult}
                debugContext={{
                  buildId: build.id,
                  egressId: egress.id,
                  formatId: egress.formatId,
                  profileId: egress.profileId,
                  measuredAt: new Date().toISOString(),
                  buildVersion: __BUILD_VERSION__,
                  buildEnv: __BUILD_ENV__,
                  pageUrl: window.location.href,
                  userAgent: navigator.userAgent,
                }}
                formatDebugMarkdown={writeVerifyHooks.formatDebugMarkdown}
                onClose={() => setVerifyReportOpen(false)}
                inModal
                keptSectionTitle={isAtD890Write ? 'Preserved settings' : undefined}
                keptSummaryLabel={isAtD890Write ? '6 sentinel regions' : undefined}
              />
            ) : null}
          </Stack>
        ) : null}
      </ModalShell>
      <ConfirmModal
        open={flow.emptyDirectory.open}
        onClose={flow.emptyDirectory.cancel}
        title="ID directory is empty"
        confirmLabel="Write anyway"
        cancelLabel="Cancel"
        onConfirm={flow.emptyDirectory.confirm}
      >
        <Text size="sm">
          Your ID directory has no rows. Fetch or import IDs before writing, or continue if you
          intend to write without ID directory entries.
        </Text>
      </ConfirmModal>
      <RadioWriteStepper
        config={stepperConfig}
        view={flowView}
        actions={{ ...flowActions, onViewCheckReport: () => setVerifyReportOpen(true) }}
      />
      {isAtD890Write ? <RangeChangeBanner buildId={build.id} /> : null}
      <WriteHeaderCard
        radioLabel={radioLabel}
        summary={
          facts
            ? buildSummaryLine({
                channels: facts.channelCount,
                zones: facts.zoneCount,
                ...(isAtD890Write
                  ? { settingChanges: atD890OverrideCount(settingsSession.overrides) }
                  : {}),
              })
            : undefined
        }
        writeHidden={writeHidden}
        disabled={!serialOk || flowView.busy}
        onWrite={openWriteRadio}
      />
      {!serialOk ? <Alert color="yellow">{getRadioSerialUnsupportedMessage()}</Alert> : null}
      <BeforeYouWriteRows
        radioLabel={descriptor?.label ?? 'radio'}
        outOfRangeNames={facts?.outOfRangeChannelNames ?? []}
        txRangeInfo={isAtD890Write}
      />
      {isAtD890Write ? <AtD890RadioSettingsCard buildId={build.id} egress={egress} /> : null}
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
              settingsChangeCount={atD890OverrideCount(settingsSession.overrides)}
              buildId={build.id}
              hasHydration={hasHydration}
              mm9pdy={isMm9pdyAtD890RadioIoProfileId(egress.profileId)}
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
      {isAtD890Write && !supportsSingleBankWrite ? (
        <Text size="xs" c="dimmed">
          {AT_D890_DIGITAL_CONTACTS_WRITE_GAP}
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}
