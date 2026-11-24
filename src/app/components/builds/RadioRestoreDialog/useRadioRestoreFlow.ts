/**
 * State machine for Restore in the shared egress dialog: connect → review → restoring → restart → done.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RadioBackupManifestV1 } from '@integrations/radio-io/backup/index.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type {
  ProgressUpdate,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  assertRestoreIdentity,
  atD890RangeMismatch,
  defaultRestorableRegionIds,
  restoreRadioBackup,
  type RadioBackupSession,
} from '../../../services/radioBackupRestore.ts';
import {
  classifyWriteError,
  reportWriteError,
  retryLabelFor,
  type WriteErrorOutcome,
  type WriteErrorPhase,
} from '../../../services/egress/writeErrorOutcome.ts';
import { resolveWriteShellOptions } from '../../../services/egress/writeShellOptions.ts';
import { closeRadioSession, openRadioSessionForEgress } from '../../../services/radioIoSession.ts';
import { createProgressCoalescer } from '../../../lib/progressCoalescer.ts';
import { useRestartCountdown } from '../../radio-io/useRestartCountdown.ts';
import {
  newTrack,
  stageRows,
  trackWithEvent,
  trackWithPlan,
  type StageTrack,
} from '../RadioWriteStepper/stageRows.ts';
import type { WriteStageRow } from '../RadioWriteStepper/types.ts';
import type { PreflightCardProps } from '../../egress/PreflightCard/PreflightCard.tsx';

export type RestoreStep = 'connect' | 'review' | 'restoring' | 'restart' | 'done';

export interface RestoreIdentityView {
  label: string;
  serial?: string;
  firmware?: string;
}

export interface RestoreFlowView {
  open: boolean;
  step: RestoreStep;
  busy: boolean;
  errorOutcome: WriteErrorOutcome | null;
  retryLabel: string | null;
  preflight: {
    status: 'checking' | 'passed' | 'refused';
    identity?: PreflightCardProps['identity'];
    rows: PreflightCardProps['rows'];
  };
  identity: RestoreIdentityView | null;
  rangeMismatch: boolean;
  regionIds: readonly string[];
  backup: RadioBackupSession | null;
  progress: ProgressUpdate | null;
  restoreStartedAt: number | null;
  restoreRows: WriteStageRow[];
  restartSecondsLeft: number;
  successNote?: string;
}

export interface RestoreFlowActions {
  onClose: () => void;
  onAbort: () => void;
  onCancelReview: () => void;
  onRestore: () => void;
  onRetry: () => void;
  onBackToExport: () => void;
}

export interface UseRadioRestoreFlowArgs {
  egress: EgressPath;
  descriptor: RadioDescriptor | undefined;
  profileId: string;
}

export class RestoreCancelledError extends Error {
  constructor() {
    super('Restore cancelled on Review.');
    this.name = 'RestoreCancelledError';
  }
}

function now(): number {
  return Date.now();
}

function preflightRowsForIdentity(
  manifest: RadioBackupManifestV1,
  identity: RestoreIdentityView,
): PreflightCardProps['rows'] {
  const archivedSerial = manifest.serial?.trim();
  if (archivedSerial) {
    return [
      { label: 'Model', value: identity.label, status: 'ok' },
      { label: 'Serial', value: identity.serial ?? '(unreadable)', status: 'ok' },
      {
        label: 'Serial matches the backup',
        value: archivedSerial,
        status: 'ok',
      },
    ];
  }
  return [
    { label: 'Model', value: identity.label, status: 'ok' },
    {
      label: 'Model matches the backup',
      value: manifest.descriptorLabel,
      status: 'ok',
    },
  ];
}

export function useRadioRestoreFlow(args: UseRadioRestoreFlowArgs): {
  view: RestoreFlowView;
  actions: RestoreFlowActions;
  open: (backup: RadioBackupSession, regionIds: readonly string[]) => void;
} {
  const { egress, descriptor, profileId } = args;
  const shellOptions = useMemo(
    () => resolveWriteShellOptions(egress, descriptor),
    [egress, descriptor],
  );
  const restartWaitSeconds = shellOptions.restartAfterEndSeconds;

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<RestoreStep>('connect');
  const [busy, setBusy] = useState(false);
  const [errorOutcome, setErrorOutcome] = useState<WriteErrorOutcome | null>(null);
  const [retryLabel, setRetryLabel] = useState<string | null>(null);
  const [preflight, setPreflight] = useState<RestoreFlowView['preflight']>({
    status: 'checking',
    rows: [],
  });
  const [identity, setIdentity] = useState<RestoreIdentityView | null>(null);
  const [rangeMismatch, setRangeMismatch] = useState(false);
  const [regionIds, setRegionIds] = useState<readonly string[]>([]);
  const [backup, setBackup] = useState<RadioBackupSession | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [restoreStartedAt, setRestoreStartedAt] = useState<number | null>(null);
  const [restoreTrack, setRestoreTrack] = useState<StageTrack>(() => newTrack());

  const backupRef = useRef<RadioBackupSession | null>(null);
  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const coalescerRef = useRef<ReturnType<typeof createProgressCoalescer> | null>(null);
  const transmitStartedRef = useRef(false);
  const userCancelledRef = useRef(false);
  const lastPhaseRef = useRef<WriteErrorPhase>('connect');
  const reviewDecisionRef = useRef<{ resolve: () => void; reject: (err: Error) => void } | null>(
    null,
  );
  const connectGenerationRef = useRef(0);
  const rangeMismatchRef = useRef(false);
  const regionIdsRef = useRef<readonly string[]>([]);

  useEffect(() => {
    rangeMismatchRef.current = rangeMismatch;
  }, [rangeMismatch]);
  useEffect(() => {
    regionIdsRef.current = regionIds;
  }, [regionIds]);

  const restartCountdown = useRestartCountdown();
  const restartSecondsLeft = restartCountdown.secondsLeft;

  useEffect(() => () => coalescerRef.current?.cancel(), []);

  function errorContext(phase: WriteErrorPhase): Parameters<typeof classifyWriteError>[1] {
    return {
      phase,
      transmitStarted: transmitStartedRef.current,
      userCancelled: userCancelledRef.current,
      radioLabel: descriptor?.label ?? 'radio',
      profileId,
      stage: progress?.stage,
      build: { version: __BUILD_VERSION__, env: __BUILD_ENV__ },
    };
  }

  async function releaseSession(): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) await closeRadioSession(session);
  }

  function resetRun() {
    setErrorOutcome(null);
    setRetryLabel(null);
    setPreflight({ status: 'checking', rows: [] });
    setIdentity(null);
    setRangeMismatch(false);
    setProgress(null);
    setRestoreStartedAt(null);
    setRestoreTrack(newTrack());
    transmitStartedRef.current = false;
    userCancelledRef.current = false;
    restartCountdown.clear();
    coalescerRef.current?.cancel();
    coalescerRef.current = null;
    reviewDecisionRef.current = null;
  }

  function onProgress(p: ProgressUpdate) {
    coalescerRef.current ??= createProgressCoalescer(setProgress);
    coalescerRef.current.push(p);
    if (p.stage) {
      transmitStartedRef.current = true;
      setRestoreTrack((t) => trackWithEvent(t, p));
    }
  }

  function showError(err: unknown, phase: WriteErrorPhase) {
    lastPhaseRef.current = phase;
    const outcome = classifyWriteError(err, errorContext(phase));
    reportWriteError(outcome);
    setErrorOutcome(outcome);
    setRetryLabel(retryLabelFor(outcome, phase));
    setBusy(false);
  }

  async function connectAtPreflight(signal: AbortSignal): Promise<void> {
    const archive = backupRef.current;
    if (!archive) return;
    setPreflight({ status: 'checking', rows: [] });
    const { session } = await openRadioSessionForEgress(egress, {
      forcePortSelection: true,
      purpose: 'restore',
      signal,
    });
    sessionRef.current = session;
    const identityResult = await assertRestoreIdentity(session, archive.manifest, { signal });
    const live = sessionRef.current;
    const mismatch =
      live?.radio instanceof AtD890uvProtocol &&
      atD890RangeMismatch(archive, live.radio.getIdentBandCode());
    setRangeMismatch(mismatch);
    if (mismatch) {
      const all = defaultRestorableRegionIds(archive.manifest, profileId);
      regionIdsRef.current = all;
      setRegionIds(all);
    }
    const identityView: RestoreIdentityView = {
      label: identityResult.label,
      serial: identityResult.serial,
      firmware: identityResult.firmware,
    };
    setIdentity(identityView);
    const rows = preflightRowsForIdentity(archive.manifest, identityView);
    setPreflight({
      status: 'passed',
      identity: { model: identityView.label, serial: identityView.serial },
      rows,
    });
    setStep('review');
    setBusy(false);
    void beginRestoreAfterReview();
  }

  async function runConnect(): Promise<void> {
    const gen = ++connectGenerationRef.current;
    resetRun();
    setBusy(true);
    lastPhaseRef.current = 'connect';
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    try {
      await connectAtPreflight(signal);
      if (gen !== connectGenerationRef.current) return;
    } catch (err) {
      if (gen !== connectGenerationRef.current) return;
      await releaseSession().catch(() => undefined);
      if (err instanceof RestoreCancelledError) {
        setIsOpen(false);
        return;
      }
      setPreflight((p) => ({
        ...p,
        status: 'refused',
        identity: { model: descriptor?.label ?? '' },
        rows: p.rows.length
          ? p.rows
          : [{ label: 'Model', value: descriptor?.label ?? '', status: 'ok' }],
      }));
      showError(err, 'preflight');
    }
  }

  function awaitReviewConfirm(): Promise<void> {
    setBusy(false);
    return new Promise<void>((resolve, reject) => {
      reviewDecisionRef.current = { resolve, reject };
    });
  }

  async function runRestore(): Promise<void> {
    const archive = backupRef.current;
    if (!archive || !sessionRef.current) return;
    userCancelledRef.current = false;
    setErrorOutcome(null);
    setRetryLabel(null);
    setBusy(true);
    lastPhaseRef.current = 'restore';
    setStep('restoring');
    const started = now();
    setRestoreStartedAt(started);
    const plan = descriptor ? planForOperation(descriptor, 'restore', {}) : undefined;
    const restoreStages = plan ?? [];
    setRestoreTrack((t) => trackWithPlan(t, restoreStages.length > 0 ? restoreStages : undefined));
    try {
      await restoreRadioBackup(
        sessionRef.current,
        { manifest: archive.manifest, image: archive.image },
        {
          regionIds: rangeMismatchRef.current
            ? defaultRestorableRegionIds(archive.manifest, profileId)
            : regionIdsRef.current,
          onProgress,
          signal: abortRef.current?.signal,
          profileId,
        },
      );
      coalescerRef.current?.flush();
      await releaseSession();
      setBusy(false);
      if (restartWaitSeconds > 0) {
        restartCountdown.start(restartWaitSeconds);
        setStep('restart');
        window.setTimeout(() => {
          restartCountdown.clear();
          setStep('done');
        }, restartWaitSeconds * 1000);
      } else {
        setStep('done');
      }
    } catch (err) {
      await releaseSession().catch(() => undefined);
      coalescerRef.current?.flush();
      showError(err, 'restore');
    }
  }

  async function beginRestoreAfterReview(): Promise<void> {
    try {
      await awaitReviewConfirm();
      await runRestore();
    } catch (err) {
      if (err instanceof RestoreCancelledError) {
        await releaseSession().catch(() => undefined);
        setIsOpen(false);
        return;
      }
      showError(err, 'review');
    }
  }

  const restoreRows = stageRows(restoreTrack, {
    finished: step === 'done',
    startActive: step === 'restoring',
  });

  const view: RestoreFlowView = {
    open: isOpen,
    step,
    busy,
    errorOutcome,
    retryLabel,
    preflight,
    identity,
    rangeMismatch,
    regionIds,
    backup,
    progress,
    restoreStartedAt,
    restoreRows,
    restartSecondsLeft,
    successNote: shellOptions.successNote,
  };

  const actions: RestoreFlowActions = {
    onClose: () => {
      if (step === 'review') {
        reviewDecisionRef.current?.reject(new RestoreCancelledError());
        return;
      }
      abortRef.current?.abort();
      connectGenerationRef.current += 1;
      void releaseSession();
      setIsOpen(false);
    },
    onAbort: () => {
      userCancelledRef.current = true;
      abortRef.current?.abort();
    },
    onCancelReview: () => {
      reviewDecisionRef.current?.reject(new RestoreCancelledError());
    },
    onRestore: () => {
      reviewDecisionRef.current?.resolve();
    },
    onRetry: () => {
      userCancelledRef.current = false;
      if (step === 'connect' || lastPhaseRef.current === 'preflight') {
        void runConnect();
        return;
      }
      void beginRestoreAfterReview();
    },
    onBackToExport: () => {
      setIsOpen(false);
    },
  };

  return {
    view,
    actions,
    open: (nextBackup: RadioBackupSession, initialRegionIds: readonly string[]) => {
      backupRef.current = nextBackup;
      regionIdsRef.current = initialRegionIds;
      setBackup(nextBackup);
      setRegionIds(initialRegionIds);
      resetRun();
      setStep('connect');
      setIsOpen(true);
      void runConnect();
    },
  };
}
