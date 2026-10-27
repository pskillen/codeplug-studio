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
  writeSourceIncludesDirectory,
  type DigitalContactsWriteSource,
  type DualBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { isAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { reviewNeedsReconnect } from '@integrations/radio-io/programHold.ts';
import { planForOperation } from '@integrations/radio-io/plannedStages.ts';
import {
  decodeAtD890RadioSettings,
  languageLockFromLocalInfo,
  mm9pdyStepKeyOverrides,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { d890DownloadStages } from '@integrations/radio-io/radios/at-d890uv/plannedStages.ts';
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
import { useRestartCountdown } from '../../radio-io/useRestartCountdown.ts';
import { loadLibrarySlice } from '../../../lib/loadLibrarySlice.ts';
import { persistence } from '../../../state/persistence.ts';
import {
  clearOverride,
  defaultSettingsChoice,
  getAtD890RadioSettingsSession,
  isSettingsReadRadio,
  overridesForWrite,
  setOverride,
  setRead,
  setStepperTicks,
} from '../../../state/atD890RadioSettingsSession.ts';
import { addBackupThisSession, findBackupForSerial } from '../../../state/radioSessionBackups.ts';
import {
  packAtD890BackupFromSession,
  downloadRadioBackupZip,
} from '../../../services/radioBackupRestore.ts';
import {
  clearInterruptedWriteWarning,
  interruptedWriteNotice,
} from '../../../services/radioIoInterruptedWrite.ts';
import type { AtD890PendingBlock } from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { getAtD890SessionSerial } from '@integrations/radio-io/radios/at-d890uv/programSession.ts';
import { atD890SettingsReadFromSnapshot } from '../../../services/radioIoAtD890SettingsRead.ts';
import { writeAtD890SettingsOnly } from '../../../services/radioIoAtD890SettingsWrite.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
  verifyRadioWrite,
  RadioWriteCancelledError,
  type AtD890PreTransmitContext,
  type AtD890PreTransmitResult,
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
import './d890/registerAtD890Review.tsx';
import {
  createAtD890ReviewController,
  type AtD890ReviewController,
} from './d890/atD890ReviewController.ts';
import {
  atD890ReceiveOnlyChannels,
  atD890ReviewRange,
  atD890SettingChanges,
} from './d890/atD890ReviewFacts.ts';
import { reviewSectionsFor } from './reviewSections.tsx';
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
  WriteReviewView,
  WriteStep,
  WriteSummary,
} from './types.ts';
import { estimateWriteSeconds, measuredThroughput } from './writeEstimate.ts';
import { clampPartsToSupport } from './writeParts.ts';
import { DEFAULT_WRITE_PARTS, writesToRadioImage, type WriteParts } from './writeParts.ts';

/** Clock for event handlers (kept out of render by the purity lint). */
function now(): number {
  return Date.now();
}

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
  supportsDualBankWrite: boolean;
  /** Keps adapter for this profile, when there is one. */
  kepsWriteFn?: SatelliteKepsWriteFn;
  /** The keps writer can share the codeplug's session (D890). Otherwise the radio restarts first. */
  kepsSameSessionAfterUpload: boolean;
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
  /** Empty-RadioID-directory prompt shown before the read starts. */
  emptyDirectory: { open: boolean; confirm: () => void; cancel: () => void };
}

interface WrittenFacts {
  codeplugWritten: boolean;
  contactsWritten: boolean;
  /** Radio settings were applied to this radio (the count of fields that changed). */
  settingsChanged: number | null;
  channelCount: number;
  kepsResult: SatelliteKepsWriteResult | null;
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
  kepsError: null,
  warnings: [],
  writeTimings: null,
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
    kepsWriteFn,
    kepsSameSessionAfterUpload,
    onOpenSettingsPage,
  } = args;
  const isAtD890 = isAtD890RadioIoProfileId(egress.profileId);
  const supportsDigitalContacts = supportsDualBankWrite;
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
  const [pendingBlock, setPendingBlock] = useState<AtD890PendingBlock | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  // Stage lists (4a's cursor): one track per list, kept in a ref so no event is lost between renders.
  const readTrackRef = useRef<StageTrack>(newTrack());
  const writeTrackRef = useRef<StageTrack>(newTrack());
  const [readTrack, setReadTrack] = useState<StageTrack>(readTrackRef.current);
  const [writeTrack, setWriteTrack] = useState<StageTrack>(writeTrackRef.current);
  const [identity, setIdentity] = useState<RadioIdentityView | null>(null);
  const [review, setReview] = useState<WriteReviewView | null>(null);
  const [writeFinished, setWriteFinished] = useState(false);
  const restartCountdown = useRestartCountdown();
  const restartSecondsLeft = restartCountdown.secondsLeft;
  const [checkStatus, setCheckStatus] = useState<CheckStatus>('none');
  const [checkResult, setCheckResult] = useState<WriteVerifyResult | null>(null);
  const [kepsAfterRestart, setKepsAfterRestart] =
    useState<WriteFlowView['kepsAfterRestart']>('none');
  const [kepsFailure, setKepsFailure] = useState<string | null>(null);
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
  const checkResultRef = useRef<WriteVerifyResult | null>(null);
  const kepsPendingRef = useRef(false);
  const satellitesRef = useRef<Satellite[]>([]);
  const pendingEmptyDirectoryRef = useRef<(() => void) | null>(null);
  const settingsAppliedRef = useRef<number | null>(null);
  const reviewUnsubscribeRef = useRef<(() => void) | null>(null);
  const d890ControllerRef = useRef<AtD890ReviewController | null>(null);
  const partsRef = useRef(parts);
  const contactSourceRef = useRef(contactSource);
  useEffect(() => {
    partsRef.current = parts;
    contactSourceRef.current = contactSource;
  });

  function setPhaseBoth(next: Phase) {
    phaseRef.current = next;
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
      abortRef.current?.abort();
      decisionRef.current?.reject(new WriteCancelledError());
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void closeRadioSession(session);
    };
  }, []);

  function onProgress(p: ProgressUpdate) {
    setProgress(p);
    const stage = p.stage;
    if (!stage) return;
    if (phaseRef.current === 'read') {
      readLabelsRef.current.add(stage);
      updateReadTrack((t) => trackWithEvent(t, p));
      return;
    }
    if (phaseRef.current === 'write') transmitStartedRef.current = true;
    // The read's stages are not part of the write list (DM-32 re-emits 'Discover memory map').
    if (readLabelsRef.current.has(stage)) return;
    updateWriteTrack((t) => trackWithEvent(t, p));
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
    setError(null);
    setPendingBlock(null);
    setCanReconnect(false);
    setReconnecting(false);
    setProgress(null);
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
    autoProceedRef.current = false;
    settingsAppliedRef.current = null;
    d890ControllerRef.current = null;
    reviewUnsubscribeRef.current?.();
    reviewUnsubscribeRef.current = null;
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

  /** The pause: show Review and wait for Write / Cancel. Auto-proceeds on a reconnect pass. */
  function awaitReview(
    ctx: {
      identity: RadioIdentityView;
      channelCount: number;
      plan?: PlannedStage[];
      identityOnly: boolean;
      atD890?: AtD890PreTransmitContext;
      channels?: readonly RadioChannelDto[];
    },
    extra: { contactsNote: string | null; kepsCount: number | null },
  ): Promise<void> {
    const reviewIdentity: RadioIdentityView = ctx.atD890?.masterIdName
      ? { ...ctx.identity, name: ctx.atD890.masterIdName }
      : ctx.identity;
    ctx = { ...ctx, identity: reviewIdentity };
    identityRef.current = ctx.identity;
    setIdentity(ctx.identity);
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
    const writeOnly = writePartOfPlan(ctx.plan, readPlanRef.current);
    if (ctx.atD890) {
      d890ControllerRef.current = buildD890Controller(ctx.atD890, ctx.channels ?? [], p);
    } else {
      d890ControllerRef.current = null;
    }
    updateWriteTrack((t) => trackWithPlan(t, writeOnly));
    const estimateSeconds = ctx.identityOnly
      ? null
      : estimateWriteSeconds(writeOnly, rate, descriptor?.nominalBytesPerSecond);
    const sectionsCtx = {
      identity: ctx.identity,
      parts: p,
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      restartsAfterWrite: requiresReconnect && writesToRadioImage(p),
      ...(d890ControllerRef.current ? { atD890: d890ControllerRef.current } : {}),
    };
    setReview({
      channelCount: ctx.channelCount,
      contactsNote: extra.contactsNote,
      kepsCount: extra.kepsCount,
      estimateSeconds,
      identityOnly: ctx.identityOnly,
      sections: descriptor ? reviewSectionsFor(descriptor, sectionsCtx) : [],
      writeDisabled: d890ControllerRef.current ? !d890ControllerRef.current.canWrite() : false,
      effectiveParts: effectivePartsFor(p),
    });
    const controller = d890ControllerRef.current;
    if (controller) {
      reviewUnsubscribeRef.current?.();
      // Keep the footer's Write button in step with the choice (settings alone with Keep writes nothing).
      reviewUnsubscribeRef.current = controller.subscribe(() => {
        setReview((r) =>
          r
            ? {
                ...r,
                writeDisabled: !controller.canWrite(),
                effectiveParts: effectivePartsFor(partsRef.current),
              }
            : r,
        );
      });
    }
    setBusyNotify(false);
    setStep('review');
    reviewOpenedAtRef.current = now();
    return new Promise<void>((resolve, reject) => {
      decisionRef.current = { resolve, reject };
    });
  }

  /** The D890 Review's live state: range, receive-only channels, settings choice and backup. */
  function buildD890Controller(
    atCtx: AtD890PreTransmitContext,
    channels: readonly RadioChannelDto[],
    p: WriteParts,
  ): AtD890ReviewController {
    const store = getAtD890RadioSettingsSession(build.id);
    const sameRadio = isSettingsReadRadio(store, atCtx.serial);
    const existing = findBackupForSerial(build.id, atCtx.serial);
    const fullReadHeld = atCtx.downloadCache !== undefined;
    const download = estimateWriteSeconds(d890DownloadStages(), null);
    const controller: AtD890ReviewController = createAtD890ReviewController({
      buildId: build.id,
      serial: atCtx.serial,
      masterIdName: atCtx.masterIdName,
      range: atD890ReviewRange(atCtx.snapshot),
      receiveOnly: atD890ReceiveOnlyChannels(channels, atCtx.snapshot.bandCode),
      snapshot: atCtx.snapshot,
      target: atCtx.target,
      decoded: decodeAtD890RadioSettings(atCtx.snapshot, atCtx.target),
      languageLock: languageLockFromLocalInfo(atCtx.snapshot.localInfo),
      getOverrides: () => overridesForWrite(build.id),
      onClearLanguage: () => clearOverride(build.id, 'language'),
      initialSettingsTicked: p.settings,
      sameRadio,
      applyToEveryRadio: store.applyToEveryRadio,
      settingsOnly: p.settings && !writesToRadioImage(p),
      fullReadHeld,
      readRestSeconds: download == null ? null : Math.round(download / 5) * 5,
      initialChoice: defaultSettingsChoice(store, atCtx.serial),
      initialBackup: existing ? { status: 'saved', at: existing.at } : { status: 'none' },
      onSaveBackup: () => void saveD890Backup(atCtx, () => controller),
      onReviewSettings: () => {
        setRead(build.id, atD890SettingsReadFromSnapshot(atCtx.snapshot, atCtx.target, now()));
        decisionRef.current?.reject(new ReviewSettingsRequestedError());
      },
      onUseStepKeys: () => {
        for (const o of mm9pdyStepKeyOverrides()) setOverride(build.id, o.fieldId, o.value);
        const next = { ...partsRef.current, settings: true };
        partsRef.current = next;
        setParts(next);
        // Asking for the keys is asking for them to be written: Use implies Apply, even on another
        // radio where Keep is preselected (70- §2.4; the user's latest action wins).
        controller.setChoice('apply');
        controller.setSettingsTicked(true);
      },
    });
    return controller;
  }

  /** Review's "Save backup now": the zip of the read this Write already did (same format as Backup). */
  async function saveD890Backup(
    atCtx: AtD890PreTransmitContext,
    controller: () => AtD890ReviewController,
  ): Promise<void> {
    const session = sessionRef.current;
    const c = controller();
    if (!session) return;
    try {
      let cache = atCtx.downloadCache;
      if (!cache) {
        c.setBackup({ status: 'reading' });
        await session.radio.download({ signal: abortRef.current?.signal });
        cache =
          session.radio instanceof AtD890uvProtocol
            ? (session.radio.getDownloadCache() ?? undefined)
            : undefined;
      }
      c.setBackup({ status: 'saving' });
      const packed = packAtD890BackupFromSession(session, cache ? { cache } : undefined);
      downloadRadioBackupZip(packed.zipBytes, packed.manifest);
      const at = now();
      addBackupThisSession(build.id, {
        serial: atCtx.serial,
        model: session.descriptor.label,
        name: atCtx.masterIdName,
        at,
      });
      c.setBackup({ status: 'saved', at });
    } catch (err) {
      c.setBackup({ status: 'error', message: errorMessage(err) });
    }
  }

  /**
   * What the pause decides about the settings: Apply (with the overrides as they stand now) only
   * when Radio settings is ticked, there are overrides, and the choice is Apply; otherwise Keep.
   */
  function settingsPauseResult(): AtD890PreTransmitResult {
    if (!settingsWillBeWritten()) return 'keep';
    return { decision: 'apply', overrides: overridesForWrite(build.id) };
  }

  /** Radio settings is ticked, there are overrides, and the choice is Apply. */
  function settingsWillBeWritten(): boolean {
    const c = d890ControllerRef.current;
    if (!c) return false;
    const state = c.getState();
    return (
      state.settingsTicked && state.choice === 'apply' && overridesForWrite(build.id).length > 0
    );
  }

  /** The ticked parts, minus settings when the pause would answer Keep (the button names what is sent). */
  function effectivePartsFor(p: WriteParts): WriteParts {
    if (!d890ControllerRef.current || !p.settings || settingsWillBeWritten()) return p;
    return { ...p, settings: false };
  }

  /** How many fields the applied settings changed on this radio (for the Done screen). */
  function changedCount(): number {
    const c = d890ControllerRef.current;
    if (!c) return 0;
    const overrides = overridesForWrite(build.id);
    return atD890SettingChanges(c.init.snapshot, c.init.target, overrides).length;
  }

  /** After Review → Write: refuse to transmit on a session the radio may have dropped. */
  function enterWriting() {
    if (reviewNeedsReconnect(descriptor ?? {}, now() - reviewOpenedAtRef.current)) {
      throw new ReconnectRequiredError();
    }
    setPhaseBoth('write');
    setProgress(null);
    setStep('writing');
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
    updateReadTrack(() => newTrack());
    updateWriteTrack(() => newTrack());
    setReview(null);
    setBusyNotify(true);
    readStartRef.current = now();
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
      const mode: DualBankWriteMode = p.codeplug ? 'codeplug' : 'digitalIdList';

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
            : undefined,
        );
        setProgress(null);
      }

      const session = await ensureSession(true, granted);
      readStartRef.current = now();
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
          parts: p,
          ...(isAtD890 && p.settings ? { settingsOverrides: overridesForWrite(build.id) } : {}),
          beforeTransmit: async (ctx: BeforeTransmitContext) => {
            await awaitReview(
              { ...ctx, channels: ctx.channels ?? image.channels },
              { contactsNote, kepsCount },
            );
            enterWriting();
            if (!ctx.atD890) return undefined;
            const decision = settingsPauseResult();
            if (typeof decision !== 'string') settingsAppliedRef.current = changedCount();
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
        await afterUpload(session, p, signal, result.writeVerifyPending);
        return;
      }

      // Radio settings alone (AT-D890): read the settings, Review, then patch the one settings unit.
      if (isAtD890 && p.settings) {
        const overrides = overridesForWrite(build.id);
        const settingsPlan = descriptor
          ? planForOperation(descriptor, 'write', { parts: p, session })
          : undefined;
        const result = await writeAtD890SettingsOnly(session, egress, overrides, {
          onProgress,
          signal,
          beforeTransmit: async (atCtx: AtD890PreTransmitContext) => {
            await awaitReview(
              {
                identity: { model: session.descriptor.label, serial: atCtx.serial },
                channelCount: 0,
                identityOnly: false,
                ...(settingsPlan ? { plan: settingsPlan } : {}),
                atD890: atCtx,
              },
              { contactsNote: null, kepsCount },
            );
            enterWriting();
            const decision = settingsPauseResult();
            if (typeof decision !== 'string') settingsAppliedRef.current = changedCount();
            return decision;
          },
        });
        factsRef.current = {
          ...factsRef.current,
          settingsChanged: settingsAppliedRef.current,
        };
        await afterUpload(session, p, signal, result.writeVerifyPending);
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
      isAtD890 && sessionRef.current ? getAtD890SessionSerial(sessionRef.current.pipe) : '';
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
    // A D890 Write interrupted after whole units were sent leaves them pending on the radio (#1406).
    const notice = interruptedWriteNotice(egress.profileId, err, failedSerial);
    setPendingBlock(notice?.block ?? null);
    setError(notice?.text ? `${errorMessage(err)} ${notice.text}` : errorMessage(err));
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
      checkResultRef.current = result;
      setCheckResult(result);
      setCheck(result.ok ? 'passed' : 'failed');
      setBusyNotify(false);
      if (!kepsPendingRef.current) goDone();
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
    pendingWarning:
      error && pendingBlock
        ? { recordedAt: pendingBlock.recordedAt, interrupted: pendingBlock.interrupted }
        : null,
    reconnecting,
    progress,
    readRows: stageRows(readTrack, { finished: readFinished, startActive: true }),
    writeRows: stageRows(writeTrack, { finished: writeFinished, startActive: true }),
    identity,
    review,
    restartSecondsLeft,
    checkStatus,
    kepsAfterRestart,
    kepsFailure,
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
    onClearPendingWarning: () => {
      if (pendingBlock) clearInterruptedWriteWarning(pendingBlock);
      setPendingBlock(null);
      setError(null);
      setCanReconnect(false);
    },
    onCheckWrite: () => void checkWrite(),
    onSkipCheck: skipOutstanding,
    onWriteKepsAfterRestart: () => void writeKepsAfterRestart(),
    onWriteAnother: () => void writeAnother(),
    onViewCheckReport: () => undefined,
    onEditSettings: () => {
      // Keep the ticks for when the user comes back; the dialog closes (nothing has been read yet).
      setStepperTicks(build.id, { ...partsRef.current });
      setIsOpen(false);
      onOpenSettingsPage?.();
    },
  };

  return {
    view,
    actions,
    open: (initialParts?: Partial<WriteParts>) => {
      const store = getAtD890RadioSettingsSession(build.id);
      const hasChanges = isAtD890 && store.overrides.size > 0;
      const restored = isAtD890 ? store.stepperTicks : undefined;
      if (restored) setStepperTicks(build.id, undefined);
      setParts(
        clampPartsToSupport(
          {
            ...DEFAULT_WRITE_PARTS,
            settings: hasChanges,
            ...(restored ?? {}),
            ...(initialParts ?? {}),
          },
          { contacts: true, keps: true, settings: hasChanges },
        ),
      );
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
