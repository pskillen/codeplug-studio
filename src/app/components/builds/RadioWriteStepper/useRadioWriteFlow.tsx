/**
 * State machine and service calls behind the Write stepper (#1393):
 * whatToWrite → connectRead → review → writing → restartCheck → done.
 *
 * Each part maps to the services Write already used: the codeplug and contacts go through one
 * `prepareRadioWriteImage` + `uploadPreparedRadioWrite` session (the codeplug's mode and contact
 * source are what the old popup's buttons picked); keps use the keps adapter. The session is held
 * open between the read and the transmit; `beforeTransmit` is the pause.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  dualBankOptionsFromWriteSource,
  writeSourceIncludesDirectory,
  type DigitalContactsWriteSource,
  type DualBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import {
  classifyWriteError,
  reportWriteError,
  retryLabelFor,
  type WriteErrorContext,
  type WriteErrorOutcome,
  type WriteErrorPhase,
} from '../../../services/egress/writeErrorOutcome.ts';
import { reviewNeedsReconnect } from '@integrations/radio-io/programHold.ts';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioDescriptor,
  RadioPlanContext,
  RadioSession,
  RadioWriteRefusal,
} from '@integrations/radio-io/types.ts';
import type {
  WriteVerifyPendingPayload,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';
import { listOfferedDangerZoneTools } from '../../../services/dangerZone/gate.ts';
import { RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID } from '../../../services/dangerZone/registry.ts';
import { useRestartCountdown } from '../../radio-io/useRestartCountdown.ts';
import { loadLibrarySlice } from '../../../lib/loadLibrarySlice.ts';
import { createProgressCoalescer, type ProgressCoalescer } from '../../../lib/progressCoalescer.ts';
import { persistence } from '../../../state/persistence.ts';
import {
  clearInterruptedWriteWarning,
  interruptedWriteNotice,
  type InterruptedWriteNotice,
} from '../../../services/radioIoInterruptedWrite.ts';
import {
  radioSettingsPartFor,
  radioWriteExtrasFor,
  type RadioSettingsPartDeps,
  type SettingsOnlyReviewContext,
  type SettingsReviewController,
} from '../../../services/egress/radioSettingsParts.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
  verifyRadioWrite,
  RadioWriteBlockedError,
  RadioWriteCancelledError,
  type AtD890PreTransmitContext,
  type AtD890PreTransmitResult,
  type BeforeTransmitContext,
  type GrantedRadioSerialPort,
  type Rt95PreTransmitContext,
  type Rt95PreTransmitResult,
} from '../../../services/radioIoSession.ts';
import {
  clearWriteVerifyPending,
  deserializeWriteVerifyPending,
  loadWriteVerifyPending,
  saveWriteVerifyPending,
  serializeWriteVerifyPending,
} from '../../../services/writeVerifyStorage.ts';
import {
  enrichSatelliteKepsWriteResult,
  getSatelliteKepsWriteCapacity,
  kepsWriteChecks,
  satelliteKepsCapacityWarning,
  type SatelliteKepsWriteResult,
} from '../../../services/satelliteKepsWriteAdapters.ts';
import './d890/registerAtD890Review.tsx';
import './rt95/registerRt95Review.tsx';
import { reviewPauseReasons, reviewSectionsFor } from './reviewSections.tsx';
import {
  newTrack,
  readPlanFor,
  stageRows,
  trackWithEvent,
  trackWithPlan,
  writePartOfPlan,
  type StageTrack,
} from './stageRows.ts';
import type {
  CheckStatus,
  RadioIdentityView,
  WriteFlowActions,
  WriteFlowView,
  ReviewDecision,
  WriteReviewView,
  WriteStep,
  WriteSummary,
} from './types.ts';
import { estimateWriteSeconds, measuredThroughput } from './writeEstimate.ts';
import { resolveWriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import { clampPartsToSupport } from './writeParts.ts';
import {
  DEFAULT_WRITE_PARTS,
  warningsForParts,
  writesToRadioImage,
  type WriteParts,
} from './writeParts.ts';

/** Clock for event handlers (kept out of render by the purity lint). */
function now(): number {
  return Date.now();
}

type ContactSource = Exclude<DigitalContactsWriteSource, 'none'>;
type Phase = 'read' | 'write' | 'keps' | 'check';

/** Thrown out of `beforeTransmit` when the user cancels on Review: nothing is sent. */
export class WriteCancelledError extends Error {
  constructor() {
    super('Write cancelled on Review.');
    this.name = 'WriteCancelledError';
  }
}

/** Thrown out of `beforeTransmit` when Review was open longer than the radio is trusted to hold. */
export class ReconnectRequiredError extends Error {
  constructor() {
    super('The radio may have left programming mode.');
    this.name = 'ReconnectRequiredError';
  }
}

/** Thrown out of `beforeTransmit` for "Review its settings": nothing is sent, the settings page opens. */
export class ReviewSettingsRequestedError extends Error {
  constructor() {
    super('Review the settings of this radio.');
    this.name = 'ReviewSettingsRequestedError';
  }
}

export interface UseRadioWriteFlowArgs {
  build: RadioBuild;
  egress: EgressPath;
  descriptor: RadioDescriptor | undefined;
  activeProjectId: string | null;
  /** AT-D890 only: open the settings page (Edit on the part row, Review its settings). */
  onOpenSettingsPage?: () => void;
}

export interface RadioWriteFlow {
  view: WriteFlowView;
  actions: WriteFlowActions;
  /** Open the dialog at step 1 with the default ticks (or the ticks a part of the Write asks for). */
  open: (initialParts?: Partial<WriteParts>) => void;
  /** The check's result, once a check ran. */
  checkResult: WriteVerifyResult | null;
}

interface WrittenFacts {
  codeplugWritten: boolean;
  contactsWritten: boolean;
  /** Radio settings were applied to this radio (the count of fields that changed). */
  settingsChanged: number | null;
  channelCount: number;
  kepsResult: SatelliteKepsWriteResult | null;
  kepsUnitNoun: string | null;
  kepsError: string | null;
  warnings: ExportWarning[];
  /** Per-stage write timings from the upload (AT-D890); keps after a restart are not timed. */
  writeTimings: string | null;
}

const EMPTY_FACTS: WrittenFacts = {
  codeplugWritten: false,
  contactsWritten: false,
  settingsChanged: null,
  channelCount: 0,
  kepsResult: null,
  kepsUnitNoun: null,
  kepsError: null,
  warnings: [],
  writeTimings: null,
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useRadioWriteFlow(args: UseRadioWriteFlowArgs): RadioWriteFlow {
  const { build, egress, descriptor, activeProjectId, onOpenSettingsPage } = args;
  const settingsPart = radioSettingsPartFor(egress.profileId);
  const writeExtras = radioWriteExtrasFor(egress.profileId);
  const shellOptions = useMemo(
    () => resolveWriteShellOptions(egress, descriptor),
    [egress, descriptor],
  );
  const kepsWriteFn = shellOptions.keps?.writeFn;
  const kepsSameSessionAfterUpload = shellOptions.keps?.session === 'same';
  const supportsDualBankWrite = shellOptions.parts.contacts;
  const supportsRadioSettings = shellOptions.parts.settings;
  const supportsDigitalContacts = supportsDualBankWrite;
  const writeVerifyHooks = descriptor?.writeVerify;
  const restartWaitSeconds = shellOptions.restartAfterEndSeconds;

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<WriteStep>('whatToWrite');
  const [parts, setParts] = useState<WriteParts>({ ...DEFAULT_WRITE_PARTS });
  const [contactSource, setContactSource] = useState<ContactSource>('library');
  const [busy, setBusy] = useState(false);
  const [errorOutcome, setErrorOutcome] = useState<WriteErrorOutcome | null>(null);
  const [retryLabel, setRetryLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingBlock, setPendingBlock] = useState<InterruptedWriteNotice['block'] | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  // Stage lists (4a's cursor): one track per list, kept in a ref so no event is lost between renders.
  const readTrackRef = useRef<StageTrack>(newTrack());
  const writeTrackRef = useRef<StageTrack>(newTrack());
  const [readTrack, setReadTrack] = useState<StageTrack>(readTrackRef.current);
  const [writeTrack, setWriteTrack] = useState<StageTrack>(writeTrackRef.current);
  const [identity, setIdentity] = useState<RadioIdentityView | null>(null);
  const [review, setReview] = useState<WriteReviewView | null>(null);
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>('undecided');
  const [readStartedAt, setReadStartedAt] = useState<number | null>(null);
  const [writeStartedAt, setWriteStartedAt] = useState<number | null>(null);
  const [checkStartedAt, setCheckStartedAt] = useState<number | null>(null);
  const [writeFinished, setWriteFinished] = useState(false);
  const restartCountdown = useRestartCountdown();
  const restartSecondsLeft = restartCountdown.secondsLeft;
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('none');
  const [checkResult, setCheckResult] = useState<WriteVerifyResult | null>(null);
  const [kepsAfterRestart, setKepsAfterRestart] =
    useState<WriteFlowView['kepsAfterRestart']>('none');
  const [kepsFailure, setKepsFailure] = useState<string | null>(null);
  const [summary, setSummary] = useState<WriteSummary | null>(null);
  const [buildChecks, setBuildChecks] = useState<WriteFlowView['buildChecks']>({
    status: 'idle',
    warnings: [],
    refusals: [],
  });
  const projectionRefusalsRef = useRef<readonly RadioWriteRefusal[]>([]);
  const kepsRefusalsRef = useRef<readonly RadioWriteRefusal[]>([]);
  const kepsWarningsRef = useRef<readonly ExportWarning[]>([]);
  const prepareWarningsRef = useRef<readonly ExportWarning[]>([]);
  const buildRefusalsRef = useRef<readonly RadioWriteRefusal[]>([]);
  const preflightFindingsRef = useRef<readonly ExportWarning[]>([]);
  const [preflight, setPreflight] = useState<WriteFlowView['preflight']>({
    status: 'checking',
    rows: [],
  });
  const [channelLabel, setChannelLabel] = useState<
    ((entityId: string) => string | undefined) | undefined
  >(undefined);
  const buildWarningsRef = useRef<readonly ExportWarning[]>([]);
  const prepareAbortRef = useRef<AbortController | null>(null);
  const prepareCacheRef = useRef<{
    key: string;
    promise: Promise<Awaited<ReturnType<typeof prepareRadioWriteImage>>>;
    result?: Awaited<ReturnType<typeof prepareRadioWriteImage>>;
  } | null>(null);
  const prepareDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const directoryAttemptRef = useRef(0);
  useEffect(
    () => () => {
      directoryAttemptRef.current += 1;
    },
    [],
  );
  const [directoryStatus, setDirectoryStatus] =
    useState<NonNullable<WriteFlowView['contactDirectoryStatus']>>('checking');
  const needsDirectory =
    supportsDigitalContacts && parts.contacts && writeSourceIncludesDirectory(contactSource);

  useEffect(() => {
    if (!isOpen || !needsDirectory) return;
    let cancelled = false;
    if (!activeProjectId) return;
    void persistence.countDigitalIdDirectoryEntries(activeProjectId).then(
      (count) => {
        if (!cancelled) setDirectoryStatus(count === 0 ? 'empty' : 'ready');
      },
      () => {
        if (!cancelled) setDirectoryStatus('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isOpen, needsDirectory, activeProjectId, contactSource]);

  function prepareCacheKey(p: WriteParts, contactSource: ContactSource): string {
    const source = p.contacts ? contactSource : 'none';
    return `${build.revision}|${p.codeplug}|${p.contacts}|${source}`;
  }

  function publishBuildChecks(
    status: WriteFlowView['buildChecks']['status'],
    extra?: Pick<WriteFlowView['buildChecks'], 'message' | 'progress'>,
  ): void {
    const mergedRefusals = [...projectionRefusalsRef.current, ...kepsRefusalsRef.current];
    const mergedWarnings = [...prepareWarningsRef.current, ...kepsWarningsRef.current];
    buildRefusalsRef.current = mergedRefusals;
    buildWarningsRef.current = mergedWarnings;
    setBuildChecks({ status, warnings: mergedWarnings, refusals: mergedRefusals, ...extra });
  }

  useEffect(() => {
    if (!isOpen || !activeProjectId) return undefined;
    if (!parts.keps || !kepsWriteFn) {
      kepsRefusalsRef.current = [];
      kepsWarningsRef.current = [];
      if (!writesToRadioImage(parts)) {
        queueMicrotask(() => publishBuildChecks('idle'));
      } else {
        queueMicrotask(() => publishBuildChecks('ready'));
      }
      return undefined;
    }
    let cancelled = false;
    void persistence.listSatellites(activeProjectId).then((all) => {
      if (cancelled) return;
      const enabled = all.filter((s) => s.enabled);
      const checks = kepsWriteChecks(egress.profileId, enabled, build.satelliteOverrides);
      kepsRefusalsRef.current = checks.refusals;
      kepsWarningsRef.current = checks.warnings;
      if (!writesToRadioImage(parts)) {
        publishBuildChecks('ready');
        return;
      }
      publishBuildChecks('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    activeProjectId,
    parts.keps,
    parts.codeplug,
    parts.contacts,
    parts.settings,
    kepsWriteFn,
    egress.profileId,
    build.satelliteOverrides,
    build.revision,
  ]);

  useEffect(() => {
    if (!isOpen || !activeProjectId) return;
    if (!writesToRadioImage(parts)) {
      prepareWarningsRef.current = [];
      projectionRefusalsRef.current = [];
      queueMicrotask(() => publishBuildChecks(parts.keps && kepsWriteFn ? 'ready' : 'idle'));
      return undefined;
    }
    const key = prepareCacheKey(parts, contactSource);
    prepareDebounceRef.current = setTimeout(() => {
      prepareDebounceRef.current = null;
      prepareAbortRef.current?.abort();
      const ac = new AbortController();
      prepareAbortRef.current = ac;
      publishBuildChecks('checking', { progress: undefined });
      const runPrepare = async (): Promise<Awaited<ReturnType<typeof prepareRadioWriteImage>>> => {
        const library = await loadLibrarySlice(persistence, activeProjectId);
        if (ac.signal.aborted) throw ac.signal.reason;
        setChannelLabel(() => (entityId: string) => {
          const ch = library.channels.find((c) => c.id === entityId);
          return ch ? channelDisplayLabel(ch) : undefined;
        });
        const writeMode: DualBankWriteMode = parts.codeplug ? 'codeplug' : 'digitalIdList';
        const dualBankPrepare = supportsDualBankWrite
          ? {
              dualBank: {
                mode: writeMode,
                options: dualBankOptionsFromWriteSource(parts.contacts ? contactSource : 'none'),
              },
              persistence,
              projectId: activeProjectId,
              onProgress: (u: ProgressUpdate) => {
                setBuildChecks((prev) =>
                  prev.status === 'checking' ? { ...prev, progress: u.msg } : prev,
                );
              },
            }
          : {};
        return prepareRadioWriteImage(build, egress, library, {
          ...dualBankPrepare,
          signal: ac.signal,
        });
      };
      const promise = runPrepare()
        .then((result) => {
          prepareWarningsRef.current = warningsForParts(parts, result);
          projectionRefusalsRef.current = parts.codeplug
            ? (descriptor?.checkWriteProjection?.({
                channels: result.channels,
                organisation: result.organisation,
              }) ?? [])
            : [];
          publishBuildChecks('ready');
          if (prepareCacheRef.current?.key === key) {
            prepareCacheRef.current = { ...prepareCacheRef.current, result };
          }
          return result;
        })
        .catch((err) => {
          if (ac.signal.aborted) throw err;
          prepareWarningsRef.current = [];
          projectionRefusalsRef.current = [];
          if (err instanceof RadioWriteBlockedError) {
            publishBuildChecks('error', { message: err.message });
          } else {
            publishBuildChecks('error', { message: String(err) });
          }
          throw err;
        });
      prepareCacheRef.current = { key, promise };
    }, 300);
    return () => {
      if (prepareDebounceRef.current != null) clearTimeout(prepareDebounceRef.current);
      prepareAbortRef.current?.abort();
    };
  }, [
    isOpen,
    activeProjectId,
    build.revision,
    build.id,
    parts,
    contactSource,
    egress,
    supportsDualBankWrite,
    descriptor,
  ]);

  // React state cannot prevent a second click before the next render (including port picking).
  const writeActionPendingRef = useRef(false);
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const grantedPortRef = useRef<GrantedRadioSerialPort | null>(null);
  const decisionRef = useRef<{ resolve: () => void; reject: (err: Error) => void } | null>(null);
  const reviewOpenedAtRef = useRef(0);
  const autoProceedRef = useRef(false);
  const phaseRef = useRef<Phase>('read');
  const readStartRef = useRef(0);
  const readPlanRef = useRef<PlannedStage[]>([]);
  const transmitStartedRef = useRef(false);
  const userCancelledRef = useRef(false);
  const lastStageRef = useRef<string | undefined>(undefined);
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  const readLabelsRef = useRef<Set<string>>(new Set());
  const pendingVerifyRef = useRef<WriteVerifyPendingPayload | null>(null);
  const factsRef = useRef<WrittenFacts>({ ...EMPTY_FACTS });
  const identityRef = useRef<RadioIdentityView | null>(null);
  const checkStatusRef = useRef<CheckStatus>('none');
  const checkResultRef = useRef<WriteVerifyResult | null>(null);
  const kepsPendingRef = useRef(false);
  const satellitesRef = useRef<Satellite[]>([]);
  const settingsAppliedRef = useRef<number | null>(null);
  const reviewUnsubscribeRef = useRef<(() => void) | null>(null);
  const settingsControllerRef = useRef<SettingsReviewController | null>(null);
  const partsRef = useRef(parts);
  const contactSourceRef = useRef(contactSource);
  useEffect(() => {
    partsRef.current = parts;
    contactSourceRef.current = contactSource;
  });

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
  }

  function errorContext(phase: WriteErrorPhase): WriteErrorContext {
    return {
      phase,
      transmitStarted: transmitStartedRef.current,
      userCancelled: userCancelledRef.current,
      radioLabel: descriptor?.label ?? 'radio',
      profileId: egress.profileId,
      stage: lastStageRef.current,
      build: { version: __BUILD_VERSION__, env: __BUILD_ENV__ },
    };
  }

  function runPhaseFromHook(): WriteErrorPhase {
    return stepRef.current === 'review' ? 'review' : phaseRef.current;
  }

  function showPlainError(outcome: WriteErrorOutcome): void {
    setErrorOutcome(outcome);
    setRetryLabel(retryLabelFor(outcome, runPhaseFromHook()));
    setNotice(null);
  }

  function fail(err: unknown, phase: WriteErrorPhase): void {
    const outcome = classifyWriteError(err, errorContext(phase));
    reportWriteError(outcome);
    if (outcome.kind === 'cancelled') {
      setNotice(outcome.message);
      setErrorOutcome(null);
      setRetryLabel(null);
      setPendingBlock(null);
      setStep('whatToWrite');
      return;
    }
    showPlainError(outcome);
  }

  function setBusyNotify(next: boolean) {
    setBusy(next);
  }

  function setCheck(next: CheckStatus) {
    checkStatusRef.current = next;
    setCheckStatus(next);
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  // Leaving the page drops the session; the radio is closed the way a read-only session is.
  useEffect(() => {
    return () => {
      coalescerRef.current?.cancel();
      abortRef.current?.abort();
      decisionRef.current?.reject(new WriteCancelledError());
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  // Every event is folded into the track refs at once (so none is lost or reordered); React state
  // is flushed at about 10 Hz, and immediately on a stage change or a stage's last event (#1558).
  const coalescerRef = useRef<ProgressCoalescer | null>(null);
  function coalescer(): ProgressCoalescer {
    coalescerRef.current ??= createProgressCoalescer((p) => {
      setProgress(p);
      setReadTrack(readTrackRef.current);
      setWriteTrack(writeTrackRef.current);
    });
    return coalescerRef.current;
  }

  function clearProgress() {
    coalescerRef.current?.cancel();
    setProgress(null);
    // A cancelled flush must not leave the stage lists behind the refs.
    setReadTrack(readTrackRef.current);
    setWriteTrack(writeTrackRef.current);
  }

  function onProgress(p: ProgressUpdate) {
    const stage = p.stage;
    if (stage) lastStageRef.current = stage;
    if (stage) {
      if (phaseRef.current === 'read') {
        readLabelsRef.current.add(stage);
        readTrackRef.current = trackWithEvent(readTrackRef.current, p);
      } else {
        if (phaseRef.current === 'write') transmitStartedRef.current = true;
        // The read's stages are not part of the write list (DM-32 re-emits 'Discover memory map').
        if (!readLabelsRef.current.has(stage)) {
          writeTrackRef.current = trackWithEvent(writeTrackRef.current, p);
        }
      }
    }
    coalescer().push(p);
  }

  function updateReadTrack(fn: (t: StageTrack) => StageTrack) {
    readTrackRef.current = fn(readTrackRef.current);
    setReadTrack(readTrackRef.current);
  }

  function updateWriteTrack(fn: (t: StageTrack) => StageTrack) {
    writeTrackRef.current = fn(writeTrackRef.current);
    setWriteTrack(writeTrackRef.current);
  }

  async function ensureSession(
    forWrite: boolean,
    grantedPort?: GrantedRadioSerialPort,
  ): Promise<RadioSession> {
    if (sessionRef.current) return sessionRef.current;
    const { session } = await openRadioSessionForEgress(egress, {
      forcePortSelection: !grantedPort,
      grantedPort,
      purpose: forWrite ? 'write' : 'read',
    });
    sessionRef.current = session;
    return session;
  }

  function resetRun() {
    setErrorOutcome(null);
    setRetryLabel(null);
    setNotice(null);
    setPendingBlock(null);
    setReconnecting(false);
    clearProgress();
    readPlanRef.current = [];
    updateReadTrack(() => newTrack());
    updateWriteTrack(() => newTrack());
    setIdentity(null);
    identityRef.current = null;
    setReview(null);
    setWriteFinished(false);
    restartCountdown.clear();
    setCheck('none');
    setCheckResult(null);
    checkResultRef.current = null;
    setKepsFailure(null);
    setKepsAfterRestart('none');
    kepsPendingRef.current = false;
    setSummary(null);
    pendingVerifyRef.current = null;
    clearWriteVerifyPending();
    factsRef.current = { ...EMPTY_FACTS };
    readLabelsRef.current = new Set();
    transmitStartedRef.current = false;
    userCancelledRef.current = false;
    lastStageRef.current = undefined;
    autoProceedRef.current = false;
    settingsAppliedRef.current = null;
    settingsControllerRef.current = null;
    reviewUnsubscribeRef.current?.();
    reviewUnsubscribeRef.current = null;
    setReviewDecision('undecided');
    preflightFindingsRef.current = [];
    setPreflight({ status: 'checking', rows: [] });
    setReadStartedAt(null);
    setWriteStartedAt(null);
    setCheckStartedAt(null);
    setPhaseBoth('read');
  }

  function goDone() {
    const facts = factsRef.current;
    setSummary({
      codeplugWritten: facts.codeplugWritten,
      contactsWritten: facts.contactsWritten,
      settingsChanged: facts.settingsChanged,
      settingsTicked: partsRef.current.settings,
      channelCount: facts.channelCount,
      kepsResult: facts.kepsResult,
      kepsUnitNoun: facts.kepsUnitNoun,
      kepsTicked: partsRef.current.keps,
      kepsError: facts.kepsError,
      warnings: facts.warnings,
      checkStatus: checkStatusRef.current,
      // A ref, not the render's state: check-then-keps reaches here from an older closure.
      checkResult: checkResultRef.current,
      identity: identityRef.current,
      writeTimings: facts.writeTimings,
    });
    setBusyNotify(false);
    setStep('done');
  }

  /**
   * The pause: show Review and wait for Write / Cancel. Auto-proceeds on a reconnect pass, and
   * whenever no per-radio provider gives a reason to stop (`reviewPauseReasons`, #1638).
   */
  function awaitReview(
    ctx: {
      identity: RadioIdentityView;
      channelCount: number;
      plan?: PlannedStage[];
      identityOnly: boolean;
      atD890?: AtD890PreTransmitContext;
      rt95Settings?: Rt95PreTransmitContext;
      channels?: readonly RadioChannelDto[];
    },
    extra: {
      contactsNote: string | null;
      kepsCount: number | null;
      rt95?: {
        modData?: { zones: number; descriptions: number; zoneKey?: { group: number; key: number } };
      };
    },
  ): Promise<void> {
    const reviewIdentity: RadioIdentityView = ctx.atD890?.masterIdName
      ? { ...ctx.identity, name: ctx.atD890.masterIdName }
      : ctx.identity;
    ctx = { ...ctx, identity: reviewIdentity };
    identityRef.current = ctx.identity;
    setIdentity(ctx.identity);
    // Before any early return: a reconnect pass reset the write track, and step 5's bar, percent
    // and time left need this plan's weights.
    const writeOnly = writePartOfPlan(ctx.plan, readPlanRef.current);
    updateWriteTrack((t) => trackWithPlan(t, writeOnly));
    if (autoProceedRef.current) {
      autoProceedRef.current = false;
      // The user already pressed Write; the hold clock restarts with this fresh read.
      reviewOpenedAtRef.current = now();
      return Promise.resolve();
    }
    const p = partsRef.current;
    const readMs = now() - readStartRef.current;
    const rate = measuredThroughput(
      readPlanRef.current.length ? readPlanRef.current : undefined,
      readMs,
    );
    const tx = ctx as BeforeTransmitContext;
    const settingsDeps = settingsPartDeps();
    settingsControllerRef.current = settingsPart
      ? settingsPart.createReviewController(tx, ctx.channels ?? [], settingsDeps)
      : null;
    const estimateSeconds = ctx.identityOnly
      ? null
      : estimateWriteSeconds(writeOnly, rate, descriptor?.nominalBytesPerSecond);
    let radioBindings: Record<string, unknown> = {};
    if (settingsControllerRef.current && settingsPart) {
      radioBindings = settingsPart.reviewSectionBindings(
        settingsControllerRef.current,
        tx,
        extra.rt95?.modData,
      );
    } else if (extra.rt95?.modData) {
      radioBindings = { rt95: extra.rt95 };
    }
    const sectionsCtx = {
      identity: ctx.identity,
      parts: p,
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      restartsAfterWrite: restartWaitSeconds > 0 && writesToRadioImage(p),
      buildWarnings: buildWarningsRef.current,
      radioWarnings: [...(tx.radioWarnings ?? []), ...preflightFindingsRef.current],
      channelLabel,
      ...radioBindings,
    };
    // Read and write in one go unless Review shows something the user must act on (#1638). The
    // user already chose to write on step 1 (Read & write); nothing has been sent yet.
    const pauseReasons = descriptor ? reviewPauseReasons(descriptor, sectionsCtx) : [];
    if (pauseReasons.length === 0) {
      reviewUnsubscribeRef.current?.();
      reviewUnsubscribeRef.current = null;
      reviewOpenedAtRef.current = now();
      setReviewDecision('skipped');
      return Promise.resolve();
    }
    const reviewDisabled = () => {
      const c = settingsControllerRef.current;
      return Boolean(c && !c.canWrite());
    };
    setReview({
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      sections: descriptor ? reviewSectionsFor(descriptor, sectionsCtx) : [],
      writeDisabled: reviewDisabled(),
      effectiveParts: effectivePartsFor(p),
    });
    const controller = settingsControllerRef.current;
    reviewUnsubscribeRef.current?.();
    if (controller) {
      // Keep the footer's Write button in step with the choice (settings alone with Keep writes nothing).
      reviewUnsubscribeRef.current = controller.subscribe(() => {
        const update = {
          writeDisabled: reviewDisabled(),
          effectiveParts: effectivePartsFor(partsRef.current),
        };
        setReview((r) => (r ? { ...r, ...update } : r));
      });
    } else {
      reviewUnsubscribeRef.current = null;
    }
    setBusyNotify(false);
    setReviewDecision('paused');
    setStep('review');
    reviewOpenedAtRef.current = now();
    return new Promise<void>((resolve, reject) => {
      decisionRef.current = { resolve, reject };
    });
  }

  function settingsPartDeps(): RadioSettingsPartDeps {
    return {
      buildId: build.id,
      egress,
      now,
      getParts: () => partsRef.current,
      setParts: (next) => {
        partsRef.current = next;
        setParts(next);
      },
      requestReviewSettings: () => {
        decisionRef.current?.reject(new ReviewSettingsRequestedError());
      },
      getSession: () => sessionRef.current,
      getSignal: () => abortRef.current?.signal,
      getDescriptor: () => descriptor,
      onSettingsPlan: (plan) => {
        readStartRef.current = now();
        if (plan?.length) {
          updateWriteTrack((t) => trackWithPlan(t, plan));
        }
      },
    };
  }

  function settingsWillBeWritten(): boolean {
    const c = settingsControllerRef.current;
    if (!c || !settingsPart) return false;
    return settingsPart.settingsWillBeWritten(c, build.id);
  }

  function settingsPauseResult(): AtD890PreTransmitResult | Rt95PreTransmitResult {
    const c = settingsControllerRef.current;
    if (!c || !settingsPart) return 'keep';
    return settingsPart.pauseResult(c, build.id, settingsWillBeWritten()) as
      AtD890PreTransmitResult | Rt95PreTransmitResult;
  }

  /** The ticked parts, minus settings when the pause would answer Keep (the button names what is sent). */
  function effectivePartsFor(p: WriteParts): WriteParts {
    const c = settingsControllerRef.current;
    if (!c || !p.settings || settingsWillBeWritten()) return p;
    return { ...p, settings: false };
  }

  function appliedSettingsCount(): number {
    const c = settingsControllerRef.current;
    if (!c || !settingsPart) return 0;
    return settingsPart.changedCount(c, build.id);
  }

  async function awaitReviewFromSettings(ctx: SettingsOnlyReviewContext): Promise<void> {
    if ('atD890' in ctx) {
      const atCtx = ctx.atD890;
      await awaitReview(
        {
          identity: {
            model: sessionRef.current?.descriptor.label ?? '',
            serial: atCtx.serial,
          },
          channelCount: 0,
          identityOnly: false,
          ...(ctx.settingsPlan ? { plan: ctx.settingsPlan } : {}),
          atD890: atCtx,
        },
        { contactsNote: null, kepsCount: null },
      );
      return;
    }
    await awaitReview(
      {
        identity: { model: sessionRef.current?.descriptor.label ?? '' },
        channelCount: 0,
        identityOnly: false,
        ...(ctx.settingsPlan ? { plan: ctx.settingsPlan } : {}),
        rt95Settings: ctx.rt95Settings,
      },
      { contactsNote: null, kepsCount: null },
    );
  }

  /** After Review → Write: refuse to transmit on a session the radio may have dropped. */
  function enterWriting() {
    if (reviewNeedsReconnect(descriptor ?? {}, now() - reviewOpenedAtRef.current)) {
      throw new ReconnectRequiredError();
    }
    setPhaseBoth('write');
    clearProgress();
    setStep('writing');
    setWriteStartedAt(now());
    setReconnecting(false);
    setBusyNotify(true);
  }

  async function writeKeps(session: RadioSession): Promise<void> {
    if (!kepsWriteFn) return;
    setPhaseBoth('keps');
    const result = await kepsWriteFn(session, satellitesRef.current, {
      onProgress,
      signal: abortRef.current?.signal,
      satelliteOverrides: build.satelliteOverrides,
    });
    const capacity = getSatelliteKepsWriteCapacity(egress.profileId);
    factsRef.current = {
      ...factsRef.current,
      kepsResult: enrichSatelliteKepsWriteResult(result, satellitesRef.current),
      kepsUnitNoun: capacity?.unitNoun ?? null,
    };
  }

  /** Steps 2 to 5 for the ticked parts. `reconnect` re-runs the read after the radio may have dropped. */
  async function run(opts: { reconnect: boolean }): Promise<void> {
    const p = partsRef.current;
    setStep('connect');
    setReviewDecision('undecided');
    setErrorOutcome(null);
    setRetryLabel(null);
    setNotice(null);
    setReconnecting(opts.reconnect);
    clearProgress();
    updateReadTrack(() => newTrack());
    updateWriteTrack(() => newTrack());
    setReview(null);
    setBusyNotify(true);
    transmitStartedRef.current = false;
    userCancelledRef.current = false;
    setNotice(null);
    readLabelsRef.current = new Set();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    autoProceedRef.current = opts.reconnect;
    try {
      if (!activeProjectId) throw new Error('No active project.');
      if (buildRefusalsRef.current.length > 0) {
        setBusyNotify(false);
        setStep('whatToWrite');
        return;
      }
      if (!grantedPortRef.current) {
        try {
          grantedPortRef.current = await grantRadioSerialPortForEgress({
            forcePortSelection: true,
          });
        } catch (err) {
          // Cancelling the browser picker is not a failed radio read. Scope this to the picker:
          // a NotFoundError from an established session must still be reported.
          const outcome = classifyWriteError(err, errorContext('connect'));
          reportWriteError(outcome);
          if (outcome.kind === 'cancelled') {
            setBusyNotify(false);
            setReconnecting(false);
            setNotice(outcome.message);
            setErrorOutcome(null);
            setRetryLabel(null);
            setStep('whatToWrite');
            return;
          }
          throw err;
        }
      }
      const granted = grantedPortRef.current;
      const source: DigitalContactsWriteSource = p.contacts ? contactSourceRef.current : 'none';
      const mode: DualBankWriteMode = p.codeplug ? 'codeplug' : 'digitalIdList';

      let prepared: Awaited<ReturnType<typeof prepareRadioWriteImage>> | undefined;
      if (writesToRadioImage(p)) {
        if (prepareDebounceRef.current != null) {
          clearTimeout(prepareDebounceRef.current);
          prepareDebounceRef.current = null;
        }
        const key = prepareCacheKey(p, contactSourceRef.current);
        const cache = prepareCacheRef.current;
        if (cache?.key === key && cache.result) {
          prepared = cache.result;
        } else if (cache?.key === key) {
          prepared = await cache.promise;
        } else {
          const library = await loadLibrarySlice(persistence, activeProjectId);
          setChannelLabel(() => (entityId: string) => {
            const ch = library.channels.find((c) => c.id === entityId);
            return ch ? channelDisplayLabel(ch) : undefined;
          });
          prepared = await prepareRadioWriteImage(
            build,
            egress,
            library,
            supportsDualBankWrite
              ? {
                  dualBank: { mode, options: dualBankOptionsFromWriteSource(source) },
                  persistence,
                  projectId: activeProjectId,
                  onProgress,
                  signal,
                }
              : { signal },
          );
          prepareCacheRef.current = {
            key,
            promise: Promise.resolve(prepared),
            result: prepared,
          };
        }
        prepareWarningsRef.current = warningsForParts(p, prepared);
        projectionRefusalsRef.current = p.codeplug
          ? (descriptor?.checkWriteProjection?.({
              channels: prepared.channels,
              organisation: prepared.organisation,
            }) ?? [])
          : [];
        publishBuildChecks('ready');
        if (buildRefusalsRef.current.length > 0) {
          setBusyNotify(false);
          setStep('whatToWrite');
          return;
        }
        clearProgress();
      }

      setPreflight({ status: 'checking', rows: [] });
      let session: RadioSession;
      try {
        session = await ensureSession(true, granted);
      } catch (err) {
        setPreflight({
          status: 'refused',
          identity: { model: descriptor?.label ?? '' },
          rows: [
            { label: 'Model', value: descriptor?.label ?? '', status: 'ok' },
            {
              label: 'Serial',
              value: 'not reported by this radio',
              status: 'warn',
            },
          ],
        });
        fail(err, 'preflight');
        return;
      }
      const defaultPreflightRows = [
        { label: 'Model', value: descriptor?.label ?? '', status: 'ok' as const },
        {
          label: 'Serial',
          value: 'not reported by this radio',
          status: 'warn' as const,
        },
      ];
      const preflightResult = descriptor?.writePreflight
        ? await descriptor.writePreflight(session, {
            profileId: egress.profileId,
            parts: p,
            signal,
            includesM17: Boolean(
              p.codeplug && (prepared?.radioFoundryWrite?.settings?.channelTags.size ?? 0) > 0,
            ),
          })
        : {
            identity: { model: descriptor?.label ?? '' },
            rows: defaultPreflightRows,
          };
      preflightFindingsRef.current = preflightResult.findings ?? [];
      setPreflight({
        status: preflightResult.refusal ? 'refused' : 'passed',
        identity: preflightResult.identity,
        rows: preflightResult.rows,
      });
      setIdentity(preflightResult.identity);
      identityRef.current = preflightResult.identity;
      if (preflightResult.refusal) {
        await releaseSession();
        fail(preflightResult.refusal, 'preflight');
        return;
      }
      setStep('connectRead');
      const readAt = now();
      readStartRef.current = readAt;
      setReadStartedAt(readAt);
      setPhaseBoth('read');
      const planCtx: RadioPlanContext = {
        ...(prepared
          ? { prepared: { channels: prepared.channels, organisation: prepared.organisation } }
          : {}),
        parts: p,
      };
      const readStages = descriptor && prepared ? readPlanFor(descriptor, planCtx) : [];
      readPlanRef.current = readStages;
      updateReadTrack((t) => trackWithPlan(t, readStages.length > 0 ? readStages : undefined));

      const contactsNote =
        p.contacts && prepared
          ? prepared.organisation.digitalContacts
            ? `${prepared.organisation.digitalContacts.length} digital contacts will be written.`
            : 'Digital contacts will be written from the chosen source.'
          : null;
      const kepsCount = p.keps ? satellitesRef.current.length : null;

      if (prepared && writesToRadioImage(p)) {
        const image = prepared;
        const result = await uploadPreparedRadioWrite(session, egress, image.image, {
          onProgress,
          signal,
          organisation: image.organisation,
          channels: image.channels,
          ...(image.nxdn ? { nxdn: image.nxdn, warnings: image.warnings } : {}),
          ...(image.radioFoundryWrite ? { radioFoundryWrite: image.radioFoundryWrite } : {}),
          parts: p,
          ...(p.settings && settingsPart ? settingsPart.uploadOptions(build.id) : {}),
          beforeTransmit: async (txCtx: BeforeTransmitContext) => {
            await awaitReview(
              {
                ...txCtx,
                channels: txCtx.channels ?? image.channels,
                ...(txCtx.rt95Settings ? { rt95Settings: txCtx.rt95Settings } : {}),
              },
              {
                contactsNote,
                kepsCount,
                ...(txCtx.rt95?.chipGuard.ok && image.organisation.writeRt95ModData
                  ? {
                      rt95: {
                        modData: {
                          zones: image.organisation.zones?.length ?? 0,
                          descriptions: image.channels.filter((c) => !c.empty && c.description)
                            .length,
                          ...(image.organisation.rt95ZoneKey
                            ? { zoneKey: image.organisation.rt95ZoneKey }
                            : {}),
                        },
                      },
                    }
                  : {}),
              },
            );
            enterWriting();
            if (!txCtx.atD890 && !txCtx.rt95Settings) return undefined;
            const decision = settingsPauseResult();
            if (typeof decision !== 'string') settingsAppliedRef.current = appliedSettingsCount();
            return decision;
          },
        });
        factsRef.current = {
          ...factsRef.current,
          codeplugWritten: p.codeplug,
          contactsWritten: p.contacts,
          settingsChanged: settingsAppliedRef.current,
          channelCount: (result.channels ?? image.channels).length,
          warnings: [...(result.projectionWarnings ?? image.warnings), ...(result.warnings ?? [])],
          writeTimings: result.timings ?? null,
        };
        await afterUpload(
          session,
          p,
          signal,
          result.writeVerifyPending as WriteVerifyPendingPayload | undefined,
        );
        return;
      }

      if (settingsPart && p.settings && !writesToRadioImage(p)) {
        const result = await settingsPart.writeSettingsOnly(session, settingsPartDeps(), {
          onProgress,
          signal,
          beforeTransmit: async (reviewCtx) => {
            await awaitReviewFromSettings(reviewCtx);
            enterWriting();
            const decision = settingsPauseResult();
            if (typeof decision !== 'string') settingsAppliedRef.current = appliedSettingsCount();
            return decision;
          },
        });
        factsRef.current = {
          ...factsRef.current,
          settingsChanged: settingsAppliedRef.current,
        };
        await afterUpload(
          session,
          p,
          signal,
          result.writeVerifyPending as WriteVerifyPendingPayload | undefined,
        );
        return;
      }

      // Keps alone: connect, ident, Review, then the keps write.
      await awaitReview(
        {
          identity: { model: session.descriptor.label },
          channelCount: 0,
          identityOnly: true,
        },
        { contactsNote: null, kepsCount },
      );
      enterWriting();
      await writeKeps(session);
      await releaseSession();
      coalescerRef.current?.flush();
      setWriteFinished(true);
      goDone();
    } catch (err) {
      await onRunError(err);
    }
  }

  /** Everything after the transmit: keps in the same session, END, the Check write, Done. */
  async function afterUpload(
    session: RadioSession,
    p: WriteParts,
    signal: AbortSignal,
    writeVerifyPending: WriteVerifyPendingPayload | undefined,
  ): Promise<void> {
    {
      {
        if (p.keps && kepsSameSessionAfterUpload) {
          // The keps unit is never touched by upload(); the writer does its own fresh read on the open pipe.
          // The codeplug is already on the radio (closing the session sends END, which commits it), so a
          // keps failure or abort is reported next to that fact, not as a failed write.
          try {
            await writeKeps(session);
          } catch (err) {
            const aborted = signal.aborted;
            const reason = aborted ? 'cancelled' : errorMessage(err);
            factsRef.current = { ...factsRef.current, kepsError: reason };
            setKepsFailure(reason);
          }
        }
        await releaseSession();
        kepsPendingRef.current = p.keps && !kepsSameSessionAfterUpload;
        setKepsAfterRestart(kepsPendingRef.current ? 'pending' : 'none');
        if (writeVerifyHooks && writeVerifyPending) {
          const pending: WriteVerifyPendingPayload = writeVerifyPending;
          pendingVerifyRef.current = pending;
          saveWriteVerifyPending(
            serializeWriteVerifyPending(build.id, egress.id, egress.profileId, pending),
          );
          setCheck('available');
        } else {
          setCheck('none');
        }
        coalescerRef.current?.flush();
        setWriteFinished(true);
        if (checkStatusRef.current === 'available' || kepsPendingRef.current) {
          setBusyNotify(false);
          restartCountdown.start(restartWaitSeconds);
          setStep('restartCheck');
        } else {
          goDone();
        }
      }
    }
  }

  async function onRunError(err: unknown): Promise<void> {
    // The failed radio's serial, before the session (and its pipe) is released.
    const failedSerial =
      sessionRef.current && writeExtras?.failedWriteSerial
        ? writeExtras.failedWriteSerial(sessionRef.current)
        : '';
    await releaseSession().catch(() => undefined);
    decisionRef.current = null;
    if (err instanceof ReviewSettingsRequestedError) {
      // Nothing was written; the session closed (END). The settings page opens with this radio's values.
      setBusyNotify(false);
      setIsOpen(false);
      onOpenSettingsPage?.();
      return;
    }
    if (err instanceof WriteCancelledError || err instanceof RadioWriteCancelledError) {
      reportWriteError(classifyWriteError(err, errorContext('review')));
      setBusyNotify(false);
      setIsOpen(false);
      return;
    }
    if (err instanceof ReconnectRequiredError) {
      await run({ reconnect: true });
      return;
    }
    coalescerRef.current?.flush();
    setBusyNotify(false);
    const outcome = classifyWriteError(err, errorContext(runPhaseFromHook()));
    reportWriteError(outcome);
    if (outcome.kind === 'cancelled') {
      setNotice(outcome.message);
      setErrorOutcome(null);
      setRetryLabel(null);
      setPendingBlock(null);
      setStep('whatToWrite');
      return;
    }
    const noticeText = interruptedWriteNotice(egress.profileId, err, failedSerial);
    setPendingBlock(noticeText?.block ?? null);
    const message = noticeText?.text ? `${outcome.message} ${noticeText.text}` : outcome.message;
    showPlainError({ ...outcome, message });
  }

  async function connectAndRead(): Promise<void> {
    const p = partsRef.current;
    resetRun();
    if (buildRefusalsRef.current.length > 0) {
      return;
    }
    if (p.keps && kepsWriteFn) {
      if (!activeProjectId) {
        fail(
          new RadioWriteBlockedError('No active project.', undefined, {
            retry: 'none',
            sent: 'nothing-sent',
          }),
          'read',
        );
        return;
      }
      const all = await persistence.listSatellites(activeProjectId);
      satellitesRef.current = all.filter((s) => s.enabled);
      const capacity = satelliteKepsCapacityWarning(
        egress.profileId,
        satellitesRef.current,
        build.satelliteOverrides,
      );
      if (capacity) {
        fail(
          new RadioWriteBlockedError(capacity, undefined, { retry: 'none', sent: 'nothing-sent' }),
          'read',
        );
        return;
      }
    } else {
      satellitesRef.current = [];
    }
    grantedPortRef.current = null;
    await run({ reconnect: false });
  }

  async function guardedConnectAndRead(): Promise<void> {
    const attempt = directoryAttemptRef.current;
    const p = partsRef.current;
    if (
      supportsDigitalContacts &&
      p.contacts &&
      writeSourceIncludesDirectory(contactSourceRef.current) &&
      activeProjectId
    ) {
      setDirectoryStatus('checking');
      try {
        const count = await persistence.countDigitalIdDirectoryEntries(activeProjectId);
        if (attempt !== directoryAttemptRef.current) return;
        setDirectoryStatus(count === 0 ? 'empty' : 'ready');
        if (count === 0) return;
      } catch {
        if (attempt !== directoryAttemptRef.current) return;
        setDirectoryStatus('error');
        return;
      }
    }
    await connectAndRead();
  }

  async function checkWrite(): Promise<void> {
    const pending =
      pendingVerifyRef.current ??
      (() => {
        const stored = loadWriteVerifyPending(build.id, egress.id, egress.profileId);
        return stored ? deserializeWriteVerifyPending(stored) : null;
      })();
    if (!pending) return;
    userCancelledRef.current = false;
    setNotice(null);
    setErrorOutcome(null);
    setRetryLabel(null);
    setCheck('running');
    setCheckStartedAt(now());
    setPhaseBoth('check');
    clearProgress();
    setBusyNotify(true);
    abortRef.current = new AbortController();
    try {
      const session = await ensureSession(false);
      const result = await verifyRadioWrite(session, pending, {
        onProgress,
        signal: abortRef.current.signal,
      });
      await releaseSession();
      pendingVerifyRef.current = null;
      clearWriteVerifyPending();
      checkResultRef.current = result;
      setCheckResult(result);
      setCheck(result.ok ? 'passed' : 'failed');
      setBusyNotify(false);
      if (!kepsPendingRef.current) goDone();
    } catch (err) {
      await releaseSession().catch(() => undefined);
      setBusyNotify(false);
      setCheck('available');
      fail(err, 'check');
    }
  }

  async function writeKepsAfterRestart(): Promise<void> {
    if (!kepsWriteFn) return;
    userCancelledRef.current = false;
    setNotice(null);
    setErrorOutcome(null);
    setRetryLabel(null);
    setKepsAfterRestart('running');
    setPhaseBoth('keps');
    clearProgress();
    setBusyNotify(true);
    abortRef.current = new AbortController();
    try {
      const session = await ensureSession(true);
      await writeKeps(session);
      await releaseSession();
      kepsPendingRef.current = false;
      setKepsAfterRestart('done');
      setBusyNotify(false);
      if (checkStatusRef.current !== 'available') goDone();
    } catch (err) {
      await releaseSession().catch(() => undefined);
      setBusyNotify(false);
      setKepsAfterRestart('pending');
      fail(err, 'keps');
    }
  }

  function skipOutstanding() {
    if (checkStatusRef.current === 'available') setCheck('skipped');
    pendingVerifyRef.current = null;
    clearWriteVerifyPending();
    goDone();
  }

  function close() {
    directoryAttemptRef.current += 1;
    if (step === 'review') {
      decisionRef.current?.reject(new WriteCancelledError());
      return;
    }
    if (step === 'restartCheck') {
      pendingVerifyRef.current = null;
      clearWriteVerifyPending();
    }
    setIsOpen(false);
  }

  async function writeAnother(): Promise<void> {
    // Same ticks and options; a fresh port prompt (the previous radio is restarting).
    const keep = { parts: partsRef.current };
    resetRun();
    setParts(keep.parts);
    grantedPortRef.current = null;
    await run({ reconnect: false });
  }

  function startWriteAction(action: () => Promise<void>) {
    if (writeActionPendingRef.current) return;
    writeActionPendingRef.current = true;
    void action().finally(() => {
      writeActionPendingRef.current = false;
    });
  }

  const readFinished = step !== 'connectRead';
  const view: WriteFlowView = {
    open: isOpen,
    step,
    parts,
    contactSource,
    contactDirectoryStatus: needsDirectory
      ? activeProjectId
        ? directoryStatus
        : 'error'
      : undefined,
    busy,
    errorOutcome,
    retryLabel,
    notice,
    pendingWarning:
      errorOutcome && pendingBlock
        ? { recordedAt: pendingBlock.recordedAt, interrupted: pendingBlock.interrupted }
        : null,
    reconnecting,
    progress,
    readStartedAt,
    writeStartedAt,
    checkStartedAt,
    readRows: stageRows(readTrack, { finished: readFinished, startActive: true }),
    writeRows: stageRows(writeTrack, { finished: writeFinished, startActive: true }),
    identity,
    review,
    reviewDecision,
    restartSecondsLeft,
    checkStatus,
    kepsAfterRestart,
    kepsFailure,
    summary,
    buildChecks,
    preflight,
    channelLabel,
    storageUnlockHref:
      errorOutcome?.interlockKey === 'rf-storage-foreign' &&
      listOfferedDangerZoneTools(build.radioTargetId).some(
        (t) => t.id === RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID,
      )
        ? `/builds/${build.id}/export/danger-zone/storage-claim`
        : undefined,
  };

  const actions: WriteFlowActions = {
    onClose: close,
    onPartsChange: (next) => {
      directoryAttemptRef.current += 1;
      if (next.contacts !== parts.contacts) setDirectoryStatus('checking');
      setNotice(null);
      setParts(next);
    },
    onContactSourceChange: (next) => {
      if (next === contactSource) return;
      directoryAttemptRef.current += 1;
      setDirectoryStatus('checking');
      setContactSource(next);
    },
    onConnectAndRead: () => startWriteAction(guardedConnectAndRead),
    onAbort: () => {
      userCancelledRef.current = true;
      abortRef.current?.abort();
    },
    onWrite: () => decisionRef.current?.resolve(),
    onCancelReview: () => decisionRef.current?.reject(new WriteCancelledError()),
    onRetry: () => {
      if (step === 'restartCheck' && checkStatusRef.current === 'available') {
        void checkWrite();
        return;
      }
      if (step === 'restartCheck' && kepsPendingRef.current) {
        void writeKepsAfterRestart();
        return;
      }
      startWriteAction(() => run({ reconnect: false }));
    },
    onChangeTicks: () => {
      setErrorOutcome(null);
      setRetryLabel(null);
      setNotice(null);
      setPendingBlock(null);
      setStep('whatToWrite');
    },
    onClearPendingWarning: () => {
      if (pendingBlock) clearInterruptedWriteWarning(pendingBlock);
      setPendingBlock(null);
      setErrorOutcome(null);
      setRetryLabel(null);
    },
    onCheckWrite: () => void checkWrite(),
    onSkipCheck: skipOutstanding,
    onWriteKepsAfterRestart: () => void writeKepsAfterRestart(),
    onWriteAnother: () => startWriteAction(writeAnother),
    onViewCheckReport: () => undefined,
    onEditSettings: () => {
      directoryAttemptRef.current += 1;
      settingsPart?.saveTicks(build.id, partsRef.current);
      setIsOpen(false);
      onOpenSettingsPage?.();
    },
  };

  return {
    view,
    actions,
    open: (initialParts?: Partial<WriteParts>) => {
      directoryAttemptRef.current += 1;
      const pendingSettings = settingsPart?.pendingChangeCount(build.id) ?? 0;
      const restored = settingsPart?.takeRestoredTicks(build.id);
      setParts(
        clampPartsToSupport(
          {
            ...DEFAULT_WRITE_PARTS,
            settings: pendingSettings > 0,
            ...(restored ?? {}),
            ...(initialParts ?? {}),
          },
          {
            contacts: supportsDigitalContacts,
            keps: Boolean(kepsWriteFn),
            settings: supportsRadioSettings,
          },
        ),
      );
      setContactSource('library');
      setDirectoryStatus('checking');
      setStep('whatToWrite');
      resetRun();
      setIsOpen(true);
    },
    checkResult,
  };
}
