/**
 * State machine and service calls behind the Write stepper (#1393):
 * whatToWrite → connectRead → review → writing → restartCheck → done.
 *
 * Each part maps to the services Write already used: the codeplug and contacts go through one
 * `prepareRadioWriteImage` + `uploadPreparedRadioWrite` session (the codeplug's mode and contact
 * source are what the old popup's buttons picked); keps use the keps adapter. The session is held
 * open between the read and the transmit; `beforeTransmit` is the pause.
 */

import { useEffect, useRef, useState } from 'react';
import {
  dualBankOptionsFromWriteSource,
  singleBankProjectionFromWriteSource,
  writeSourceIncludesDirectory,
  type DigitalContactsWriteSource,
  type DualBankWriteMode,
  type SingleBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { reviewNeedsReconnect } from '@integrations/radio-io/programHold.ts';
import type {
  PlannedStage,
  ProgressUpdate,
  RadioDescriptor,
  RadioPlanContext,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import type {
  WriteVerifyPendingPayload,
  WriteVerifyResult,
} from '@integrations/radio-io/writeVerify.ts';
import { loadLibrarySlice } from '../../../lib/loadLibrarySlice.ts';
import { persistence } from '../../../state/persistence.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
  verifyRadioWrite,
  type BeforeTransmitContext,
  type GrantedRadioSerialPort,
} from '../../../services/radioIoSession.ts';
import {
  clearWriteVerifyPending,
  deserializeWriteVerifyPending,
  loadWriteVerifyPending,
  saveWriteVerifyPending,
  serializeWriteVerifyPending,
} from '../../../services/writeVerifyStorage.ts';
import {
  satelliteKepsCapacityWarning,
  type SatelliteKepsWriteFn,
  type SatelliteKepsWriteResult,
} from '../../../services/satelliteKepsWriteAdapters.ts';
import { reviewSectionsFor } from './reviewSections.tsx';
import { readPlanFor, stageRows, writePartOfPlan } from './stageRows.ts';
import type {
  CheckStatus,
  RadioIdentityView,
  WriteFlowActions,
  WriteFlowView,
  WriteReviewView,
  WriteStep,
  WriteSummary,
} from './types.ts';
import { estimateWriteSeconds, measuredThroughput } from './writeEstimate.ts';
import { DEFAULT_WRITE_PARTS, writesToRadioImage, type WriteParts } from './writeParts.ts';

type ContactSource = Exclude<DigitalContactsWriteSource, 'none'>;
type Phase = 'read' | 'write' | 'keps' | 'check';

/** Seconds the stepper waits for a radio that restarts after END. */
export const RADIO_RESTART_WAIT_SECONDS = 20;

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

export interface UseRadioWriteFlowArgs {
  build: RadioBuild;
  egress: EgressPath;
  descriptor: RadioDescriptor | undefined;
  activeProjectId: string | null;
  supportsDualBankWrite: boolean;
  supportsSingleBankWrite: boolean;
  /** Keps adapter for this profile, when there is one. */
  kepsWriteFn?: SatelliteKepsWriteFn;
  /** The keps writer can share the codeplug's session (D890). Otherwise the radio restarts first. */
  kepsSameSessionAfterUpload: boolean;
  /** Fires when a read or transfer starts or ends (navigation guard). */
  onBusyChange?: (busy: boolean) => void;
}

export interface RadioWriteFlow {
  view: WriteFlowView;
  actions: WriteFlowActions;
  /** Open the dialog at step 1 with the default ticks. */
  open: () => void;
  /** The check's result, once a check ran. */
  checkResult: WriteVerifyResult | null;
  /** Empty-RadioID-directory prompt shown before the read starts. */
  emptyDirectory: { open: boolean; confirm: () => void; cancel: () => void };
}

interface WrittenFacts {
  codeplugWritten: boolean;
  contactsWritten: boolean;
  channelCount: number;
  kepsResult: SatelliteKepsWriteResult | null;
  warnings: ExportWarning[];
}

const EMPTY_FACTS: WrittenFacts = {
  codeplugWritten: false,
  contactsWritten: false,
  channelCount: 0,
  kepsResult: null,
  warnings: [],
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function useRadioWriteFlow(args: UseRadioWriteFlowArgs): RadioWriteFlow {
  const {
    build,
    egress,
    descriptor,
    activeProjectId,
    supportsDualBankWrite,
    supportsSingleBankWrite,
    kepsWriteFn,
    kepsSameSessionAfterUpload,
    onBusyChange,
  } = args;
  const supportsDigitalContacts = supportsDualBankWrite || supportsSingleBankWrite;
  const writeVerifyHooks = descriptor?.writeVerify;
  const requiresReconnect = writeVerifyHooks?.requiresCrossSessionReconnect ?? true;
  const restartWaitSeconds = requiresReconnect ? RADIO_RESTART_WAIT_SECONDS : 0;

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<WriteStep>('whatToWrite');
  const [parts, setParts] = useState<WriteParts>({ ...DEFAULT_WRITE_PARTS });
  const [contactSource, setContactSource] = useState<ContactSource>('library');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canReconnect, setCanReconnect] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [startedAt, setStartedAt] = useState<number | undefined>(undefined);
  const [readPlan, setReadPlan] = useState<PlannedStage[]>([]);
  const [writePlan, setWritePlan] = useState<PlannedStage[] | undefined>(undefined);
  const [readGrown, setReadGrown] = useState<string[]>([]);
  const [writeGrown, setWriteGrown] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('read');
  const [identity, setIdentity] = useState<RadioIdentityView | null>(null);
  const [review, setReview] = useState<WriteReviewView | null>(null);
  const [writeFinished, setWriteFinished] = useState(false);
  const [restartSecondsLeft, setRestartSecondsLeft] = useState(0);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('none');
  const [checkResult, setCheckResult] = useState<WriteVerifyResult | null>(null);
  const [kepsAfterRestart, setKepsAfterRestart] =
    useState<WriteFlowView['kepsAfterRestart']>('none');
  const [summary, setSummary] = useState<WriteSummary | null>(null);
  const [emptyDirectoryOpen, setEmptyDirectoryOpen] = useState(false);

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
  const readLabelsRef = useRef<Set<string>>(new Set());
  const pendingVerifyRef = useRef<WriteVerifyPendingPayload | null>(null);
  const factsRef = useRef<WrittenFacts>({ ...EMPTY_FACTS });
  const identityRef = useRef<RadioIdentityView | null>(null);
  const checkStatusRef = useRef<CheckStatus>('none');
  const kepsPendingRef = useRef(false);
  const satellitesRef = useRef<Satellite[]>([]);
  const pendingEmptyDirectoryRef = useRef<(() => void) | null>(null);
  const partsRef = useRef(parts);
  partsRef.current = parts;
  const contactSourceRef = useRef(contactSource);
  contactSourceRef.current = contactSource;

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function setBusyNotify(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
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
      abortRef.current?.abort();
      decisionRef.current?.reject(new WriteCancelledError());
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  // Restart countdown on step 5.
  useEffect(() => {
    if (step !== 'restartCheck' || restartSecondsLeft <= 0) return;
    const timer = window.setTimeout(() => setRestartSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [step, restartSecondsLeft]);

  function onProgress(p: ProgressUpdate) {
    setProgress(p);
    const stage = p.stage;
    if (!stage) return;
    if (phaseRef.current === 'read') {
      readLabelsRef.current.add(stage);
      setReadGrown((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
      return;
    }
    if (phaseRef.current === 'write') transmitStartedRef.current = true;
    // The read's stages are not part of the write list (DM-32 re-emits 'Discover memory map').
    if (readLabelsRef.current.has(stage)) return;
    setWriteGrown((prev) => (prev.includes(stage) ? prev : [...prev, stage]));
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
    setError(null);
    setCanReconnect(false);
    setReconnecting(false);
    setProgress(null);
    setReadPlan([]);
    readPlanRef.current = [];
    setWritePlan(undefined);
    setReadGrown([]);
    setWriteGrown([]);
    setIdentity(null);
    identityRef.current = null;
    setReview(null);
    setWriteFinished(false);
    setRestartSecondsLeft(0);
    setCheck('none');
    setCheckResult(null);
    setKepsAfterRestart('none');
    kepsPendingRef.current = false;
    setSummary(null);
    pendingVerifyRef.current = null;
    clearWriteVerifyPending();
    factsRef.current = { ...EMPTY_FACTS };
    readLabelsRef.current = new Set();
    transmitStartedRef.current = false;
    autoProceedRef.current = false;
    setPhaseBoth('read');
  }

  function goDone() {
    const facts = factsRef.current;
    setSummary({
      codeplugWritten: facts.codeplugWritten,
      contactsWritten: facts.contactsWritten,
      channelCount: facts.channelCount,
      kepsResult: facts.kepsResult,
      warnings: facts.warnings,
      checkStatus: checkStatusRef.current,
      checkResult,
      identity: identityRef.current,
    });
    setBusyNotify(false);
    setStep('done');
  }

  /** The pause: show Review and wait for Write / Cancel. Auto-proceeds on a reconnect pass. */
  function awaitReview(
    ctx: {
      identity: RadioIdentityView;
      channelCount: number;
      plan?: PlannedStage[];
      identityOnly: boolean;
    },
    extra: { contactsNote: string | null; kepsCount: number | null },
  ): Promise<void> {
    identityRef.current = ctx.identity;
    setIdentity(ctx.identity);
    if (autoProceedRef.current) {
      autoProceedRef.current = false;
      return Promise.resolve();
    }
    const p = partsRef.current;
    const readMs = Date.now() - readStartRef.current;
    const rate = measuredThroughput(
      readPlanRef.current.length ? readPlanRef.current : undefined,
      readMs,
    );
    const writeOnly = writePartOfPlan(ctx.plan, readPlanRef.current);
    setWritePlan(writeOnly);
    const estimateSeconds = ctx.identityOnly ? null : estimateWriteSeconds(writeOnly, rate);
    const sectionsCtx = {
      identity: ctx.identity,
      parts: p,
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      restartsAfterWrite: requiresReconnect && writesToRadioImage(p),
    };
    setReview({
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      sections: descriptor ? reviewSectionsFor(descriptor, sectionsCtx) : [],
    });
    setBusyNotify(false);
    setStep('review');
    reviewOpenedAtRef.current = Date.now();
    return new Promise<void>((resolve, reject) => {
      decisionRef.current = { resolve, reject };
    });
  }

  /** After Review → Write: refuse to transmit on a session the radio may have dropped. */
  function enterWriting() {
    if (reviewNeedsReconnect(descriptor ?? {}, Date.now() - reviewOpenedAtRef.current)) {
      throw new ReconnectRequiredError();
    }
    setPhaseBoth('write');
    setProgress(null);
    setStep('writing');
    setReconnecting(false);
    setBusyNotify(true);
    setStartedAt(Date.now());
  }

  async function writeKeps(session: RadioSession): Promise<void> {
    if (!kepsWriteFn) return;
    setPhaseBoth('keps');
    const result = await kepsWriteFn(session, satellitesRef.current, {
      onProgress,
      signal: abortRef.current?.signal,
      satelliteOverrides: build.satelliteOverrides,
    });
    factsRef.current = { ...factsRef.current, kepsResult: result };
  }

  /** Steps 2 to 5 for the ticked parts. `reconnect` re-runs the read after the radio may have dropped. */
  async function run(opts: { reconnect: boolean }): Promise<void> {
    const p = partsRef.current;
    setStep('connectRead');
    setError(null);
    setCanReconnect(false);
    setReconnecting(opts.reconnect);
    setProgress(null);
    setReadGrown([]);
    setWriteGrown([]);
    setReview(null);
    setBusyNotify(true);
    setStartedAt(Date.now());
    readStartRef.current = Date.now();
    setPhaseBoth('read');
    transmitStartedRef.current = false;
    readLabelsRef.current = new Set();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    autoProceedRef.current = opts.reconnect;
    try {
      if (!activeProjectId) throw new Error('No active project.');
      if (!grantedPortRef.current) {
        grantedPortRef.current = await grantRadioSerialPortForEgress({ forcePortSelection: true });
      }
      const granted = grantedPortRef.current;
      const source: DigitalContactsWriteSource = p.contacts ? contactSourceRef.current : 'none';
      const mode: DualBankWriteMode | SingleBankWriteMode = p.codeplug
        ? 'codeplug'
        : 'digitalIdList';

      let prepared: Awaited<ReturnType<typeof prepareRadioWriteImage>> | undefined;
      if (writesToRadioImage(p)) {
        setPhaseBoth('read');
        const library = await loadLibrarySlice(persistence, activeProjectId);
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
              }
            : supportsSingleBankWrite
              ? {
                  singleBank: { mode, projectionMode: singleBankProjectionFromWriteSource(source) },
                  persistence,
                  projectId: activeProjectId,
                  onProgress,
                }
              : undefined,
        );
        setProgress(null);
      }

      const session = await ensureSession(true, granted);
      readStartRef.current = Date.now();
      const planCtx: RadioPlanContext = {
        ...(prepared
          ? { prepared: { channels: prepared.channels, organisation: prepared.organisation } }
          : {}),
        parts: p,
      };
      const readStages = descriptor && prepared ? readPlanFor(descriptor, planCtx) : [];
      readPlanRef.current = readStages;
      setReadPlan(readStages);

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
          parts: p,
          beforeTransmit: async (ctx: BeforeTransmitContext) => {
            await awaitReview(ctx, { contactsNote, kepsCount });
            enterWriting();
          },
        });
        factsRef.current = {
          ...factsRef.current,
          codeplugWritten: p.codeplug,
          contactsWritten: p.contacts,
          channelCount: image.channels.length,
          warnings: [...image.warnings, ...(result.warnings ?? [])],
        };
        if (p.keps && kepsSameSessionAfterUpload) {
          // The keps unit is never touched by upload(); the writer does its own fresh read on the open pipe.
          await writeKeps(session);
        }
        await releaseSession();
        kepsPendingRef.current = p.keps && !kepsSameSessionAfterUpload;
        setKepsAfterRestart(kepsPendingRef.current ? 'pending' : 'none');
        if (writeVerifyHooks && result.writeVerifyPending) {
          const pending: WriteVerifyPendingPayload = result.writeVerifyPending;
          pendingVerifyRef.current = pending;
          saveWriteVerifyPending(
            serializeWriteVerifyPending(build.id, egress.id, egress.profileId, pending),
          );
          setCheck('available');
        } else {
          setCheck('none');
        }
        setWriteFinished(true);
        if (checkStatusRef.current === 'available' || kepsPendingRef.current) {
          setBusyNotify(false);
          setRestartSecondsLeft(restartWaitSeconds);
          setStep('restartCheck');
        } else {
          goDone();
        }
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
      setWriteFinished(true);
      goDone();
    } catch (err) {
      await onRunError(err);
    }
  }

  async function onRunError(err: unknown): Promise<void> {
    await releaseSession().catch(() => undefined);
    decisionRef.current = null;
    if (err instanceof WriteCancelledError) {
      // Nothing was written; the session closed the way a read-only session does.
      setBusyNotify(false);
      setIsOpen(false);
      return;
    }
    if (err instanceof ReconnectRequiredError) {
      await run({ reconnect: true });
      return;
    }
    setBusyNotify(false);
    setError(errorMessage(err));
    // Before the first frame, a failure is recoverable by reading again.
    setCanReconnect(!transmitStartedRef.current && phaseRef.current !== 'keps');
  }

  async function connectAndRead(): Promise<void> {
    const p = partsRef.current;
    resetRun();
    if (p.keps && kepsWriteFn) {
      if (!activeProjectId) {
        setError('No active project.');
        return;
      }
      const all = await persistence.listSatellites(activeProjectId);
      satellitesRef.current = all.filter((s) => s.enabled);
      const capacity = satelliteKepsCapacityWarning(egress.profileId, satellitesRef.current);
      if (capacity) {
        setError(capacity);
        return;
      }
    } else {
      satellitesRef.current = [];
    }
    grantedPortRef.current = null;
    await run({ reconnect: false });
  }

  async function guardedConnectAndRead(): Promise<void> {
    const p = partsRef.current;
    if (
      supportsDigitalContacts &&
      p.contacts &&
      writeSourceIncludesDirectory(contactSourceRef.current) &&
      activeProjectId
    ) {
      const count = await persistence.countDigitalIdDirectoryEntries(activeProjectId);
      if (count === 0) {
        pendingEmptyDirectoryRef.current = () => void connectAndRead();
        setEmptyDirectoryOpen(true);
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
    setError(null);
    setCheck('running');
    setPhaseBoth('check');
    setProgress(null);
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
      setCheckResult(result);
      setCheck(result.ok ? 'passed' : 'failed');
      setBusyNotify(false);
      if (!kepsPendingRef.current) {
        const facts = factsRef.current;
        setSummary({
          ...facts,
          checkStatus: result.ok ? 'passed' : 'failed',
          checkResult: result,
          identity: identityRef.current,
        });
        setStep('done');
      }
    } catch (err) {
      await releaseSession().catch(() => undefined);
      setBusyNotify(false);
      setCheck('available');
      setError(errorMessage(err));
    }
  }

  async function writeKepsAfterRestart(): Promise<void> {
    if (!kepsWriteFn) return;
    setError(null);
    setKepsAfterRestart('running');
    setPhaseBoth('keps');
    setProgress(null);
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
      setError(errorMessage(err));
    }
  }

  function skipOutstanding() {
    if (checkStatusRef.current === 'available') setCheck('skipped');
    pendingVerifyRef.current = null;
    clearWriteVerifyPending();
    goDone();
  }

  function close() {
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

  const readFinished = step !== 'connectRead';
  const view: WriteFlowView = {
    open: isOpen,
    step,
    parts,
    contactSource,
    busy,
    error,
    canReconnect,
    reconnecting,
    progress,
    startedAt,
    readRows: stageRows({
      plan: readPlan.length > 0 ? readPlan : undefined,
      grown: readGrown,
      progress: phase === 'read' ? progress : null,
      finished: readFinished,
      startActive: true,
    }),
    writeRows: stageRows({
      plan: writePlan,
      grown: writeGrown,
      progress: phase === 'read' ? null : progress,
      finished: writeFinished,
      startActive: true,
    }),
    identity,
    review,
    restartSecondsLeft,
    checkStatus,
    kepsAfterRestart,
    summary,
  };

  const actions: WriteFlowActions = {
    onClose: close,
    onPartsChange: setParts,
    onContactSourceChange: setContactSource,
    onConnectAndRead: () => void guardedConnectAndRead(),
    onAbort: () => abortRef.current?.abort(),
    onWrite: () => decisionRef.current?.resolve(),
    onCancelReview: () => decisionRef.current?.reject(new WriteCancelledError()),
    onReconnect: () => void run({ reconnect: false }),
    onCheckWrite: () => void checkWrite(),
    onSkipCheck: skipOutstanding,
    onWriteKepsAfterRestart: () => void writeKepsAfterRestart(),
    onWriteAnother: () => void writeAnother(),
    onViewCheckReport: () => undefined,
  };

  return {
    view,
    actions,
    open: () => {
      setParts({ ...DEFAULT_WRITE_PARTS });
      setContactSource('library');
      setStep('whatToWrite');
      resetRun();
      setIsOpen(true);
    },
    checkResult,
    emptyDirectory: {
      open: emptyDirectoryOpen,
      confirm: () => {
        setEmptyDirectoryOpen(false);
        pendingEmptyDirectoryRef.current?.();
        pendingEmptyDirectoryRef.current = null;
      },
      cancel: () => {
        setEmptyDirectoryOpen(false);
        pendingEmptyDirectoryRef.current = null;
      },
    },
  };
}
