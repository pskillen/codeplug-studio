/**
 * Mountable Write dialog: stepper on {@link EgressShell}, verify-report modal, and `open`/`busy` for any page.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Stack } from '@mantine/core';
import {
  isAtD890RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
  isRt95RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import { loadLibrarySlice } from '../../../lib/loadLibrarySlice.ts';
import { persistence } from '../../../state/persistence.ts';
import { BuildService } from '../../../state/buildService.ts';
import { useProjects } from '../../../state/useProjects.ts';
import {
  channelLocationNoteForWrite,
  descriptorsForEgress,
  isRadioSerialSupported,
} from '../../../services/radioIoSession.ts';
import { hasPersistedStepKeySwitch, mm9pdyStepKeysDescription } from '../mm9pdyStepKeysCopy.ts';
import { resolveWriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import { resolveRadioWriteGate } from '../../../services/radioWriteEnvGate.ts';
import RadioWriteStepper from '../RadioWriteStepper/RadioWriteStepper.tsx';
import { useRadioWriteFlow } from '../RadioWriteStepper/useRadioWriteFlow.tsx';
import type { WriteStepperConfig } from '../RadioWriteStepper/types.ts';
import type { WriteParts } from '../RadioWriteStepper/writeParts.ts';
import {
  atD890OverrideCount,
  overridesForWrite,
  setApplyToEveryRadio,
  setWriteSettingsRequested,
  useAtD890RadioSettingsSession,
} from '../../../state/atD890RadioSettingsSession.ts';
import {
  overridesForWrite as rt95OverridesForWrite,
  rt95OverrideCount,
  setWriteSettingsRequested as setRt95WriteSettingsRequested,
  useRt95RadioSettingsSession,
} from '../../../state/rt95RadioSettingsSession.ts';
import { rt95SettingsTargetForEgress } from '../../../services/radioIoRt95SettingsWrite.ts';
import { rt95OverrideWords } from '../RadioWriteStepper/rt95/rt95ReviewFacts.ts';
import { atD890OverrideWords } from '../RadioWriteStepper/d890/atD890ReviewFacts.ts';
import WriteVerifyReport from '../WriteVerifyReport.tsx';
import { mapWriteVerifyResultToV2Report } from '../writeVerifyReportV2Adapter.ts';
import {
  ModalShell,
  WriteVerifyReport as WriteVerifyReportV2,
  Button as V2Button,
} from '../../v2/index.ts';

const buildService = new BuildService(persistence);

export function useRadioWriteDialog(args: {
  build: RadioBuild;
  egress: EgressPath;
  onOpenSettingsPage?: () => void;
}): {
  element: ReactNode;
  open: (initialParts?: Partial<WriteParts>) => void;
  busy: boolean;
} {
  const { build, egress, onOpenSettingsPage } = args;
  const { activeProjectId, activeProject } = useProjects();
  const descriptors = descriptorsForEgress(egress);
  const descriptor = descriptors[0];
  const serialOk = isRadioSerialSupported();
  const writeGate = resolveRadioWriteGate(descriptor, undefined, egress.profileId);
  const writeHidden = writeGate === 'hidden';
  const isAtD890Write = isAtD890RadioIoProfileId(egress.profileId);
  const isRt95Write = isRt95RadioIoProfileId(egress.profileId);
  const shellOptions = resolveWriteShellOptions(egress, descriptor);
  const supportsKepsWrite = shellOptions.parts.keps;
  const writeVerifyHooks = descriptor?.writeVerify;

  const flow = useRadioWriteFlow({
    build,
    egress,
    descriptor,
    activeProjectId,
    onOpenSettingsPage,
  });
  const { view: flowView, actions: flowActions } = flow;
  const d890SettingsSession = useAtD890RadioSettingsSession(build.id);
  const rt95SettingsSession = useRt95RadioSettingsSession(build.id);
  const writeSettingsRequested =
    (isAtD890Write && d890SettingsSession.writeSettingsRequested) ||
    (isRt95Write && rt95SettingsSession.writeSettingsRequested);

  const [verifyReportOpen, setVerifyReportOpen] = useState(false);
  const [channelLocationNote, setChannelLocationNote] = useState<string | null>(null);
  const [kepsCount, setKepsCount] = useState<number | null>(null);

  useEffect(() => {
    if (!writeSettingsRequested) return;
    if (isAtD890Write) setWriteSettingsRequested(build.id, false);
    if (isRt95Write) setRt95WriteSettingsRequested(build.id, false);
    flow.open({ codeplug: false, contacts: false, keps: false, settings: true });
  }, [writeSettingsRequested, build.id, isAtD890Write, isRt95Write, flow]);

  async function loadChannelLocationNote() {
    if (!activeProjectId) return;
    try {
      const library = await loadLibrarySlice(persistence, activeProjectId);
      setChannelLocationNote(channelLocationNoteForWrite(build, egress, library));
    } catch {
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

  function open(initialParts?: Partial<WriteParts>) {
    setChannelLocationNote(null);
    setKepsCount(null);
    flow.open(initialParts);
    void loadChannelLocationNote();
    void loadKepsCount();
  }

  async function handleAssignMm9pdyStepKeys(checked: boolean) {
    const next = buildService.withExportSettings(build, { assignMm9pdyStepKeys: checked });
    await buildService.putBuild(next, build.revision);
  }

  const stepperConfig: WriteStepperConfig = {
    radioLabel: descriptor?.label ?? 'radio',
    buildId: build.id,
    serialOk,
    writeHidden,
    options: shellOptions,
    kepsSummary:
      kepsCount != null
        ? `${kepsCount} ${kepsCount === 1 ? 'satellite' : 'satellites'}`
        : undefined,
    kepsLastUpdatedIso: activeProject?.satelliteLibraryLastUpdated,
    channelLocationNote,
    ...(isAtD890Write
      ? {
          radioSettings: {
            count: atD890OverrideCount(d890SettingsSession.overrides),
            words: atD890OverrideWords(
              overridesForWrite(build.id),
              isMm9pdyAtD890RadioIoProfileId(egress.profileId) ? 'mm9pdy' : 'stock',
            ),
            applyToEveryRadio: d890SettingsSession.applyToEveryRadio,
            onApplyToEveryRadioChange: (checked: boolean) =>
              setApplyToEveryRadio(build.id, checked),
          },
        }
      : {}),
    ...(isRt95Write
      ? {
          radioSettings: {
            count: rt95OverrideCount(rt95SettingsSession.overrides),
            words: rt95OverrideWords(
              rt95OverridesForWrite(build.id),
              rt95SettingsTargetForEgress(egress),
            ),
            applyToEveryRadio: false,
            onApplyToEveryRadioChange: () => undefined,
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
  };

  const checkResult = flow.checkResult;

  const element = (
    <>
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
                keptSectionTitle={shellOptions.check.reportLabels?.keptSectionTitle}
                keptSummaryLabel={shellOptions.check.reportLabels?.keptSummaryLabel}
              />
            ) : null}
          </Stack>
        ) : null}
      </ModalShell>
      <RadioWriteStepper
        config={stepperConfig}
        view={flowView}
        actions={{ ...flowActions, onViewCheckReport: () => setVerifyReportOpen(true) }}
      />
    </>
  );

  return {
    element: descriptors.length === 0 ? null : element,
    open,
    busy: flowView.busy,
  };
}
