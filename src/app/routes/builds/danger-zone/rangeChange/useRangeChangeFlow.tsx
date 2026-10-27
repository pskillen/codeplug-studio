/**
 * State machine of the Change frequency range wizard (Danger zone, #1369), in the shape of `useRadioWriteFlow`:
 * the hook owns the sessions and the services and hands the page a `view` and `actions`.
 *
 * Sessions: A is held from Read to the `END` after the single frame (nothing is written before it); B opens after
 * the restart, verifies, restores everything and ends; C reads back. Studio never sends an `R` after the first
 * `W` of a session, and a failure after the frame never sends `END` (the service asks the engine).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  atD890MaintenanceUnlocked,
  atD890RangeChangeTargets,
  atD890TxChangeSummary,
  describeAtD890FrequencyRange,
  sanitiseAtD890RangeCode,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  type RangeChangeJournalEntry,
  type RangeChangeStage,
} from '@integrations/persistence/rangeChangeJournal.ts';
import {
  isRadioSerialSupported,
  RadioWrongIdentError,
  type ProgressUpdate,
  type RadioDescriptor,
  type RadioSession,
} from '@integrations/radio-io/index.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890VitalMismatchError } from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  AT_D890_STUN_KILL_UNKNOWN_MESSAGE,
  AtD890uvProtocol,
} from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { AtD890StunKillError } from '@integrations/radio-io/radios/at-d890uv/stunKillGuard.ts';
import {
  parseAtD890VitalZip,
  sha256Hex,
} from '@integrations/radio-io/radios/at-d890uv/vitalBackupZip.ts';
import { useRestartCountdown } from '../../../../components/radio-io/useRestartCountdown.ts';
import type { StageRow } from '../../../../components/builds/RadioIoStageList.tsx';
import {
  getRangeChangeJournal,
  getRangeChangeJournalEntry,
  removeRangeChangeJournalEntry,
  saveRangeChangeJournalEntry,
  useRangeChangeJournal,
  unfinishedRangeChanges,
} from '../../../../state/atD890RangeChangeJournal.ts';
import { clearReadForSerial } from '../../../../state/atD890RadioSettingsSession.ts';
import { addBackupThisSession } from '../../../../state/radioSessionBackups.ts';
import {
  backupForRangeChange,
  changeRange,
  checkRestored,
  identifyRangeChangeRadio,
  rangeChangeMayEndAfterRead,
  receiveOnlyAfterChange,
  restoreAfterChange,
  RangeChangeRefusedError,
  saveRangeChangeBackupPair,
  verifyAfterChange,
  type PostChangeOutcome,
  type RangeChangeBackupPair,
  type RangeChangeRadio,
} from '../../../../services/dangerZone/atD890RangeChangeService.ts';
import type { RestoreCheckResult } from '../../../../services/dangerZone/atD890RestoreCheck.ts';
import { DANGER_ZONE_DECISIONS } from '../../../../services/dangerZone/decisions.ts';
import { openRadioBackupZip } from '../../../../services/radioBackupRestore.ts';
import type { RadioBackupSession } from '../../../../services/radioBackupRestore.ts';
import {
  closeRadioSession,
  openRadioSessionForEgress,
} from '../../../../services/radioIoSession.ts';
import { buildRangeRows } from './rangeRows.ts';
import { clock, COPY, NOTHING_CHANGED, rangeLabel } from './rangeChangeCopy.ts';
import type {
  NoticeKind,
  NoticeTone,
  RangeChangeActions,
  RangeChangeChecklistItem,
  RangeChangeNotice,
  RangeChangeStep,
  RangeChangeTargetRow,
  RangeChangeView,
} from './types.ts';

const MODEL = 'AT-D890UV' as const;
const COUNTDOWN = DANGER_ZONE_DECISIONS.restartCountdownSeconds;

export interface UseRangeChangeFlowOptions {
  buildId: string;
  egress: EgressPath | undefined;
  descriptor: RadioDescriptor | undefined;
  /** Open the resume path (`resume`): a journal serial, or `'file'` for no journal. */
  resume?: { serial?: string } | undefined;
  /** Preselect this target in step 2 (Change back…). */
  initialTarget?: number | undefined;
  /** Leave for a route inside the build (`export`, `export/danger-zone/...`). */
  navigateInBuild: (path: string, state?: unknown) => void;
  /** Leave guard, supplied by the page (it needs the router). */
  leaveOpen?: boolean;
  onLeaveStay?: () => void;
  onLeaveConfirm?: () => void;
  onGuardChange?: (active: boolean) => void;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isStunKill(err: unknown): boolean {
  return (
    err instanceof AtD890StunKillError ||
    (err instanceof Error && err.message === AT_D890_STUN_KILL_UNKNOWN_MESSAGE)
  );
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'RadioAbortedError');
}

function labelledRows(
  labels: readonly string[],
  activeIndex: number,
  progress: ProgressUpdate | null,
  finished: boolean,
  failed = false,
): StageRow[] {
  return labels.map((label, i) => {
    let status: StageRow['status'] = 'pending';
    if (finished || i < activeIndex) status = 'success';
    else if (i === activeIndex) status = failed ? 'error' : 'active';
    const row: StageRow = { id: `${i}`, label, status, weight: 1 };
    if (i === activeIndex && !finished && progress?.max) {
      row.fraction = Math.min(1, progress.cur / progress.max);
    }
    return row;
  });
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function useRangeChangeFlow(opts: UseRangeChangeFlowOptions): {
  view: RangeChangeView;
  actions: RangeChangeActions;
} {
  const { buildId, egress, descriptor, navigateInBuild } = opts;
  const journalEntries = useRangeChangeJournal();

  const sessionRef = useRef<RadioSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<string>('');
  const lastStageRef = useRef<string>('');
  const mountedRef = useRef(true);
  const wipedRef = useRef(false);
  /** The session the change is running on: the engine owns it and its `END`. Set before the frame. */
  const changeSessionRef = useRef<RadioSession | null>(null);

  const restartCountdown = useRestartCountdown();
  const checkCountdown = useRestartCountdown();

  const [step, setStep] = useState<RangeChangeStep>(opts.resume ? 'resume' : 'read');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [notice, setNotice] = useState<RangeChangeNotice | null>(null);
  const [radio, setRadio] = useState<RangeChangeRadio | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [pair, setPair] = useState<RangeChangeBackupPair | null>(null);
  const [archive, setArchive] = useState<RadioBackupSession | null>(null);
  const [backupTune, setBackupTune] = useState<Uint8Array | undefined>(undefined);
  const [backupPhase, setBackupPhase] = useState<'idle' | 'running' | 'saved'>('idle');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [savedTick, setSavedTick] = useState(false);
  const [confirmTick, setConfirmTick] = useState(false);
  const [receiveOnly, setReceiveOnly] = useState<{ count: number; total: number } | null>(null);
  const [verified, setVerified] = useState(false);
  const [checklist, setChecklist] = useState<readonly RangeChangeChecklistItem[]>([]);
  const [anywayAvailable, setAnywayAvailable] = useState(false);
  const [anywayOpen, setAnywayOpen] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoreFinished, setRestoreFinished] = useState(false);
  const [wiped, setWiped] = useState(false);
  const [checkResult, setCheckResult] = useState<RestoreCheckResult | null>(null);
  const [checkFinished, setCheckFinished] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [fromCode, setFromCode] = useState<number | null>(null);
  const [toCode, setToCode] = useState<number | null>(null);
  const [journalSerial, setJournalSerial] = useState<string | null>(opts.resume?.serial ?? null);
  const [resumeFile, setResumeFile] = useState<string | null>(null);
  const [resumeVital, setResumeVital] = useState<string | null>(null);
  const [resumeFileOk, setResumeFileOk] = useState(false);
  const [initialTargetUsed, setInitialTargetUsed] = useState(false);

  useEffect(() => {
    wipedRef.current = wiped;
  }, [wiped]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      const session = sessionRef.current;
      sessionRef.current = null;
      if (!session) return;
      // While the change runs (or has run) the engine owns the session and sends its own `END`: a second one
      // from here would race it. Only the journal's `sending` state covers recovery. Before the change, END is safe.
      if (session === changeSessionRef.current) return;
      const r = session.radio;
      if (wipedRef.current && r instanceof AtD890uvProtocol) r.abandonProgramMode();
      void closeRadioSession(session).catch(() => undefined);
    };
  }, []);

  const guardActive = busy || wiped;
  const { onGuardChange } = opts;
  useEffect(() => {
    onGuardChange?.(guardActive);
  }, [guardActive, onGuardChange]);

  // ---- derived ---------------------------------------------------------------------------------------------

  const entry: RangeChangeJournalEntry | null = useMemo(() => {
    const serial = journalSerial ?? radio?.serial ?? null;
    return serial ? (journalEntries.find((e) => e.serial === serial) ?? null) : null;
  }, [journalEntries, journalSerial, radio]);

  const currentCode = radio ? radio.identCode : null;
  const currentUnlisted =
    currentCode !== null && !describeAtD890FrequencyRange(currentCode).cpsListed;

  const rangeRows: RangeChangeTargetRow[] = useMemo(
    () => (radio ? buildRangeRows(radio.identCode, radio.maintenanceUnlocked) : []),
    [radio],
  );

  // Change back…: preselect once the radio is read.
  useEffect(() => {
    if (initialTargetUsed || opts.initialTarget === undefined || rangeRows.length === 0) return;
    const row = rangeRows.find((r) => r.code === opts.initialTarget);
    if (row?.selectable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time preselection when the rows first exist
      setTarget(row.code);
    }
    setInitialTargetUsed(true);
  }, [initialTargetUsed, opts.initialTarget, rangeRows]);

  // ---- helpers ---------------------------------------------------------------------------------------------

  const say = useCallback(
    (kind: NoticeKind, tone: NoticeTone, body: string, extra?: Partial<RangeChangeNotice>) => {
      setNotice({ kind, tone, body, ...extra });
    },
    [],
  );

  function journalSerialEntry(): RangeChangeJournalEntry | undefined {
    const serial = radio?.serial ?? journalSerial ?? pair?.serial;
    return serial ? getRangeChangeJournalEntry(serial) : undefined;
  }

  function buildEntryFromState(): RangeChangeJournalEntry | null {
    if (!pair || !radio || target === null) return null;
    const now = new Date().toISOString();
    return {
      serial: pair.serial,
      model: MODEL,
      fromCode: radio.identCode,
      toCode: target,
      stage: 'sending',
      backup: { fileName: pair.backupFileName, sha256: pair.backupSha256, savedAt: pair.savedAt },
      vital: { fileName: pair.vitalFileName, sha256: pair.vitalSha256 },
      startedAt: startedAtRef.current || now,
      updatedAt: now,
      studioVersion: __BUILD_VERSION__,
    };
  }

  const writeJournal = useCallback(
    (stage: RangeChangeStage, over?: Partial<RangeChangeJournalEntry>): boolean => {
      // A new change always starts a fresh record; later stages update the one on file.
      const base =
        stage === 'sending'
          ? buildEntryFromState()
          : (journalSerialEntry() ?? buildEntryFromState());
      if (!base) return false;
      const now = new Date().toISOString();
      return saveRangeChangeJournalEntry({ ...base, ...over, stage, updatedAt: now });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair, radio, target, fromCode, toCode, archive],
  );

  function beginBusy(): AbortSignal {
    setNotice(null);
    setBusy(true);
    setProgress(null);
    lastStageRef.current = '';
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }

  function endBusy(): void {
    if (!mountedRef.current) return;
    setBusy(false);
    setProgress(null);
    abortRef.current = null;
  }

  const onProgress = useCallback((p: ProgressUpdate) => {
    if (!mountedRef.current) return;
    if (p.stage) lastStageRef.current = p.stage;
    setProgress(p);
  }, []);

  async function release(session: RadioSession | null, endSafe: boolean): Promise<void> {
    if (!session) return;
    if (!endSafe && session.radio instanceof AtD890uvProtocol) session.radio.abandonProgramMode();
    await closeRadioSession(session).catch(() => undefined);
  }

  async function releaseHeld(endSafe: boolean): Promise<void> {
    const session = sessionRef.current;
    sessionRef.current = null;
    await release(session, endSafe);
  }

  async function openSession(
    purpose: 'read' | 'restore',
    forcePicker: boolean,
    signal: AbortSignal,
  ): Promise<RadioSession> {
    if (!egress) throw new Error('This build has no radio connection.');
    const { session } = await openRadioSessionForEgress(egress, {
      forcePortSelection: forcePicker,
      purpose,
      signal,
    });
    return session;
  }

  /** Words for a connect or session failure. `afterFrame` picks the state line. */
  function sayFailure(err: unknown, afterFrame: boolean): void {
    if (isStunKill(err)) {
      say('stun-kill', 'refusal', COPY.refusal.stunKill, { nothingChanged: true });
      return;
    }
    if (err instanceof RadioWrongIdentError) {
      say('not-d890', 'refusal', COPY.refusal.notD890, { nothingChanged: !afterFrame });
      return;
    }
    if (err instanceof RangeChangeRefusedError) {
      if (err.code === 'not-d890') say('not-d890', 'refusal', COPY.refusal.notD890);
      else if (err.code === 'blank-serial')
        say('backup-refused', 'refusal', COPY.backUp.reasons['blank-serial'], {
          nothingChanged: true,
        });
      else if (err.code === 'identity-wrong')
        say('backup-refused', 'refusal', COPY.backUp.reasons['identity-wrong'], {
          nothingChanged: true,
        });
      else if (err.code === 'serial-mismatch') say('wrong-radio', 'refusal', err.message);
      else
        say('backup-refused', 'refusal', COPY.backUp.reasons['reads-differ'], {
          nothingChanged: true,
        });
      return;
    }
    if (err instanceof AtD890VitalMismatchError) {
      say('backup-refused', 'refusal', COPY.backUp.reasons['reads-differ'], {
        nothingChanged: true,
        details: err.message,
      });
      return;
    }
    if (isAbort(err)) {
      say('connect-failed', 'info', afterFrame ? COPY.refusal.lostAfter : NOTHING_CHANGED);
      return;
    }
    say(
      'connect-failed',
      'refusal',
      `${COPY.refusal.lost} ${afterFrame ? COPY.refusal.lostAfter : COPY.refusal.lostBefore}`,
      { details: errMessage(err), nothingChanged: !afterFrame },
    );
  }

  /** The radio's stun/kill state is unknown: Studio sent no `END` and the session is abandoned. */
  function sayUnreadable(err: unknown): void {
    say('unreadable', 'refusal', COPY.refusal.unreadableNoEnd, {
      nothingChanged: true,
      details: errMessage(err),
    });
  }

  // ---- steps 1 to 4 ----------------------------------------------------------------------------------------

  const connectRead = useCallback(async () => {
    const signal = beginBusy();
    setNotice(null);
    let session: RadioSession;
    let sessionOpened = false;
    try {
      session = await openSession('read', true, signal);
      sessionRef.current = session;
      sessionOpened = true;
      const identified = await identifyRangeChangeRadio(session, { signal });
      setRadio(identified);
      setFromCode(identified.identCode);
      startedAtRef.current = new Date().toISOString();
      setJournalSerial(identified.serial);
      const open = unfinishedRangeChanges(getRangeChangeJournal()).find(
        (e) => e.serial === identified.serial,
      );
      if (open) {
        // An unfinished change for this radio: nothing has been written in this session, so END is safe.
        await releaseHeld(true);
        say(
          'unfinished',
          'warning',
          COPY.banner.sending(
            MODEL,
            identified.serial,
            rangeLabel(open.toCode),
            clock(open.updatedAt),
          ),
        );
      }
    } catch (err) {
      // END only when LocalInfo was read and checked: an unreadable one leaves the stun/kill state unknown.
      const mayEnd = rangeChangeMayEndAfterRead(err);
      await releaseHeld(mayEnd);
      if (isStunKill(err) || mayEnd || !sessionOpened) sayFailure(err, false);
      else sayUnreadable(err);
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egress, descriptor]);

  function onReadNext(): void {
    if (!radio || sessionRef.current === null) return;
    setNotice(null);
    setStep('newRange');
  }

  function pickTarget(code: number): void {
    const row = rangeRows.find((r) => r.code === code);
    if (!row?.selectable) return;
    setTarget(code);
    setToCode(code);
  }

  function rangeNext(): void {
    if (target === null || target === radio?.identCode) return;
    setNotice(null);
    setStep('backUp');
  }

  /** Session A may have been closed by an earlier failure: open it again and insist on the same radio. */
  async function ensureSessionA(signal: AbortSignal): Promise<RadioSession> {
    if (sessionRef.current) return sessionRef.current;
    const session = await openSession('read', true, signal);
    sessionRef.current = session;
    const again = await identifyRangeChangeRadio(session, { signal });
    if (radio && again.serial !== radio.serial) {
      await releaseHeld(true);
      throw new RangeChangeRefusedError('serial-mismatch', 'This is not the radio you chose.');
    }
    setRadio(again);
    return session;
  }

  const startBackup = useCallback(async () => {
    const signal = beginBusy();
    setBackupPhase('running');
    setPhaseIndex(0);
    setSavedTick(false);
    try {
      const session = await ensureSessionA(signal);
      const result = await backupForRangeChange(session, {
        onProgress,
        onPhase: (p) => setPhaseIndex(p === 'codeplug' ? 0 : 1),
        signal,
      });
      setPhaseIndex(2);
      setPair(result);
      setArchive(result.backup);
      setBackupTune(result.tune);
      saveRangeChangeBackupPair(result);
      const model = result.backup.manifest.descriptorLabel;
      const at = Date.now();
      addBackupThisSession(buildId, {
        serial: result.serial,
        model,
        name: '',
        at,
        note: `Backup, ${COPY.backUp.sessionNote}`,
      });
      addBackupThisSession(buildId, {
        serial: result.serial,
        model,
        name: '',
        at,
        note: `Vital data, ${COPY.backUp.sessionNote}`,
      });
      setBackupPhase('saved');
    } catch (err) {
      setBackupPhase('idle');
      const mayEnd = rangeChangeMayEndAfterRead(err);
      await releaseHeld(mayEnd);
      if (isStunKill(err) || mayEnd) sayFailure(err, false);
      else sayUnreadable(err);
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [egress, radio, buildId, onProgress]);

  function saveAgain(): void {
    if (pair) saveRangeChangeBackupPair(pair);
  }

  function backUpNext(): void {
    if (!pair || !savedTick || target === null) return;
    setNotice(null);
    const session = sessionRef.current;
    setReceiveOnly(session ? receiveOnlyAfterChange(session, pair, target) : null);
    setConfirmTick(false);
    setStep('confirm');
  }

  // ---- step 5 -----------------------------------------------------------------------------------------------

  const doChange = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !pair || target === null || !radio || !confirmTick) return;
    const signal = beginBusy();
    setStep('change');
    let journalled = false;
    // Before anything can reach the radio: leaving the page from here on must not send an END of its own.
    changeSessionRef.current = session;
    try {
      const outcome = await changeRange(session, {
        backupLocalInfo: pair.localInfo,
        target,
        signal,
        onBeforeSend: () => {
          // Written before the frame, so a crash between the frame and END is still caught.
          journalled = writeJournal('sending');
        },
      });
      // The service has closed the session in every case.
      sessionRef.current = null;
      changeSessionRef.current = null;
      switch (outcome.kind) {
        case 'changed':
          writeJournal('changed');
          setWiped(true);
          setToCode(target);
          restartCountdown.start(COUNTDOWN);
          setNotice(null);
          setStep('restart');
          break;
        case 'nothing-changed':
          removeRangeChangeJournalEntry(pair.serial);
          if (outcome.reason === 'radio-changed') {
            say('radio-changed', 'refusal', COPY.change.radioChanged, { nothingChanged: true });
          } else {
            say('change-refused', 'refusal', COPY.change.refused(outcome.detail), {
              nothingChanged: true,
            });
          }
          break;
        case 'stun-kill':
          removeRangeChangeJournalEntry(pair.serial);
          say('stun-kill', 'refusal', COPY.refusal.stunKill, { nothingChanged: true });
          break;
        case 'unreadable':
          removeRangeChangeJournalEntry(pair.serial);
          say('unreadable', 'refusal', COPY.change.unreadable, {
            nothingChanged: true,
            details: outcome.detail,
          });
          break;
        case 'not-taken':
          removeRangeChangeJournalEntry(pair.serial);
          say('not-taken', 'refusal', COPY.change.notTaken, {
            nothingChanged: true,
            details: outcome.detail,
          });
          break;
        default:
          say('unknown', 'refusal', COPY.change.unknown, { details: outcome.detail });
          setWiped(journalled);
      }
    } catch (err) {
      sessionRef.current = null;
      changeSessionRef.current = null;
      say('unknown', 'refusal', COPY.change.unknown, { details: errMessage(err) });
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair, target, radio, confirmTick, writeJournal]);

  // ---- step 6 -----------------------------------------------------------------------------------------------

  const derivedBackupLocalInfo = useCallback((): Uint8Array | null => {
    if (pair) return pair.localInfo;
    if (archive) return archive.image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
    return null;
  }, [pair, archive]);

  function fillChecklist(outcome: PostChangeOutcome, serial: string, code: number): void {
    const ok = outcome.kind === 'ok';
    const identOk =
      ok || (outcome.kind === 'identity-differs' && outcome.result.localInfoDiffs.length === 0);
    const tuneOk =
      ok || (outcome.kind === 'identity-differs' && outcome.result.tuneDiffs.length === 0);
    const tuneChecked = 'result' in outcome ? outcome.result.tuneChecked : false;
    setChecklist([
      { id: 'same', text: COPY.restart.checklist.same(serial), ok: true },
      { id: 'range', text: COPY.restart.checklist.range(rangeLabel(code)), ok: true },
      { id: 'identity', text: COPY.restart.checklist.identity, ok: identOk },
      {
        id: 'calibration',
        text: tuneChecked
          ? COPY.restart.checklist.calibration
          : COPY.restart.checklist.calibrationSkipped,
        ok: tuneChecked ? tuneOk : true,
      },
    ]);
  }

  /**
   * Session B: connect, identify, verify. On `ok` (or `identity-differs`) the session stays open for Restore.
   * Returns true when the flow may carry on to Restore.
   */
  async function connectAndVerify(
    forcePicker: boolean,
    signal: AbortSignal,
    ctx: { serial: string; target: number | null; stage: RangeChangeStage | null },
  ): Promise<{ proceed: boolean }> {
    const li = derivedBackupLocalInfo();
    if (!li) return { proceed: false };
    let session: RadioSession;
    try {
      session = await openSession('restore', forcePicker, signal);
    } catch (err) {
      if (isStunKill(err)) {
        sayFailure(err, true);
      } else {
        say('no-port', 'warning', COPY.restart.noPort, { details: errMessage(err) });
      }
      return { proceed: false };
    }
    sessionRef.current = session;
    try {
      const live = await identifyRangeChangeRadio(session, { signal });
      if (live.serial !== ctx.serial) {
        await releaseHeld(true);
        say('wrong-radio', 'refusal', COPY.restart.wrongRadio(live.serial, ctx.serial));
        return { proceed: false };
      }
      setRadio(live);
      const code = ctx.target ?? live.identCode;
      const outcome = await verifyAfterChange(session, {
        serial: ctx.serial,
        backupLocalInfo: li,
        backupTune,
        target: code,
        signal,
      });
      return await handleVerify(outcome, live, code, ctx);
    } catch (err) {
      const stun = isStunKill(err);
      await releaseHeld(!stun);
      if (stun) sayFailure(err, true);
      else say('no-port', 'warning', COPY.restart.noPort, { details: errMessage(err) });
      return { proceed: false };
    }
  }

  async function handleVerify(
    outcome: PostChangeOutcome,
    live: RangeChangeRadio,
    code: number,
    ctx: { serial: string; stage: RangeChangeStage | null },
  ): Promise<{ proceed: boolean }> {
    fillChecklist(outcome, ctx.serial, code);
    setAnywayAvailable(false);
    switch (outcome.kind) {
      case 'ok':
        setVerified(true);
        setNotice(null);
        return { proceed: true };
      case 'wrong-radio':
        await releaseHeld(true);
        say('wrong-radio', 'refusal', COPY.restart.wrongRadio(outcome.serial, ctx.serial));
        return { proceed: false };
      case 'not-taken':
        await releaseHeld(true);
        removeRangeChangeJournalEntry(ctx.serial);
        setWiped(false);
        if (ctx.stage === 'sending') {
          say('resume-nothing-changed', 'success', COPY.resume.nothingChanged, {
            nothingChanged: true,
          });
        } else {
          say('still-old', 'warning', COPY.restart.stillOld(rangeLabel(live.identCode)), {
            nothingChanged: true,
          });
        }
        return { proceed: false };
      case 'unexpected-range':
        await releaseHeld(true);
        say('unexpected-range', 'refusal', COPY.restart.unexpected(outcome.code), {
          details: JSON.stringify(outcome.result),
        });
        return { proceed: false };
      case 'identity-differs': {
        // Restore never writes LocalInfo or calibration, so a second confirm may still offer it.
        const n = outcome.result.localInfoDiffs.length + outcome.result.tuneDiffs.length;
        say('identity-differs', 'refusal', COPY.restart.identityDiffers(n), {
          details: `LocalInfo differs at ${
            outcome.result.localInfoDiffs.map((o) => `+0x${o.toString(16)}`).join(', ') || 'none'
          }; calibration differs at ${
            outcome.result.tuneDiffs
              .slice(0, 16)
              .map((o) => `+0x${o.toString(16)}`)
              .join(', ') || 'none'
          }`,
        });
        setAnywayAvailable(DANGER_ZONE_DECISIONS.restoreAnywayBehindSecondConfirm);
        return { proceed: false };
      }
    }
  }

  const reconnect = useCallback(
    async (forcePicker: boolean) => {
      const serial = pair?.serial ?? radio?.serial ?? journalSerial ?? archive?.manifest.serial;
      if (!serial) return;
      const signal = beginBusy();
      setVerified(false);
      setChecklist([]);
      try {
        const ent = getRangeChangeJournalEntry(serial);
        await connectAndVerify(forcePicker, signal, {
          serial,
          target: toCode ?? ent?.toCode ?? null,
          stage: ent?.stage ?? null,
        });
      } finally {
        endBusy();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair, radio, journalSerial, archive, toCode, backupTune, egress],
  );

  // ---- step 7 -----------------------------------------------------------------------------------------------

  const runRestore = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !archive) return;
    const signal = beginBusy();
    setStep('restore');
    setRestoreFailed(false);
    setRestoreFinished(false);
    setAnywayOpen(false);
    setNotice(null);
    try {
      await restoreAfterChange(session, archive, { onProgress, signal });
      sessionRef.current = null;
      const serial = archive.manifest.serial ?? radio?.serial ?? '';
      if (serial) {
        const ent = getRangeChangeJournalEntry(serial);
        if (ent)
          saveRangeChangeJournalEntry({
            ...ent,
            stage: 'restored',
            updatedAt: new Date().toISOString(),
          });
      }
      setRestoreFinished(true);
      setWiped(false);
      setVerified(false);
      checkCountdown.start(COUNTDOWN);
      setStep('check');
    } catch (err) {
      sessionRef.current = null;
      setRestoreFailed(true);
      say('restore-failed', 'refusal', COPY.restore.stopped(lastStageRef.current), {
        details: errMessage(err),
      });
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, radio, onProgress]);

  const restoreAgain = useCallback(async () => {
    if (!archive) return;
    const signal = beginBusy();
    setNotice(null);
    let session: RadioSession;
    try {
      session = await openSession('restore', false, signal);
      sessionRef.current = session;
    } catch (err) {
      endBusy();
      if (isStunKill(err)) sayFailure(err, true);
      else say('no-port', 'warning', COPY.restart.noPort, { details: errMessage(err) });
      return;
    }
    endBusy();
    await runRestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, egress, runRestore]);

  // ---- step 8 and done --------------------------------------------------------------------------------------

  function finishDone(wasSkipped: boolean): void {
    const serial = archive?.manifest.serial ?? radio?.serial ?? '';
    if (serial) {
      const ent = getRangeChangeJournalEntry(serial);
      if (ent) {
        saveRangeChangeJournalEntry({ ...ent, stage: 'done', updatedAt: new Date().toISOString() });
      }
      clearReadForSerial(buildId, serial);
    }
    setSkipped(wasSkipped);
    setNotice(null);
    setStep('done');
  }

  const runCheck = useCallback(async () => {
    if (!archive) return;
    const signal = beginBusy();
    setCheckResult(null);
    setCheckFinished(false);
    let session: RadioSession;
    try {
      session = await openSession('read', false, signal);
    } catch (err) {
      endBusy();
      if (isStunKill(err)) sayFailure(err, true);
      else say('no-port', 'warning', COPY.restart.noPort, { details: errMessage(err) });
      return;
    }
    try {
      const result = await checkRestored(session, archive, { onProgress, signal });
      setCheckResult(result);
      setCheckFinished(true);
      if (result.ok) {
        finishDone(false);
      } else {
        const labels = [...new Set(result.differences.map((d) => d.label))].join(', ');
        say('check-differs', 'warning', COPY.check.differences(labels));
      }
    } catch (err) {
      if (err instanceof RangeChangeRefusedError) {
        say('wrong-radio', 'refusal', err.message);
      } else {
        say('check-failed', 'warning', `${COPY.refusal.lost} ${errMessage(err)}`);
      }
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, egress, buildId, radio, onProgress]);

  // ---- resume ------------------------------------------------------------------------------------------------

  const choices = useMemo(() => unfinishedRangeChanges(journalEntries), [journalEntries]);
  const resumeEntry = useMemo(
    () =>
      opts.resume?.serial && opts.resume.serial !== 'file'
        ? (journalEntries.find((e) => e.serial === opts.resume!.serial) ?? null)
        : null,
    [journalEntries, opts.resume],
  );

  useEffect(() => {
    // One unfinished record and no serial given: that is the one.
    if (!opts.resume || journalSerial) return;
    if (opts.resume.serial === 'file') return;
    if (choices.length === 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- picks the only unfinished record once
      setJournalSerial(choices[0]!.serial);
    }
  }, [opts.resume, journalSerial, choices]);

  const activeEntry = resumeEntry ?? (journalSerial ? entry : null);
  const fileMode = opts.resume?.serial === 'file';

  const onResumeFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setNotice(null);
      setResumeFileOk(false);
      let bytes: Uint8Array;
      let parsed: RadioBackupSession;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
        parsed = openRadioBackupZip(bytes);
      } catch {
        say('resume-bad-file', 'refusal', COPY.resume.badFile);
        return;
      }
      if (parsed.manifest.radioModelId !== MODEL) {
        say('resume-bad-file', 'refusal', COPY.resume.notD890);
        return;
      }
      if (!parsed.manifest.regions.some((r) => r.id === 'local-info')) {
        say('resume-bad-file', 'refusal', COPY.resume.noLocalInfo);
        return;
      }
      // The record on file decides which file this is: the one the wizard picked, or, in file mode (no record
      // chosen yet), the unfinished record for the zip's serial. Only with no record at all are the checks the zip's own.
      const onFile = parsed.manifest.serial
        ? getRangeChangeJournalEntry(parsed.manifest.serial)
        : undefined;
      const record = activeEntry ?? (onFile && onFile.stage !== 'done' ? onFile : undefined);
      if (record) {
        if (parsed.manifest.serial !== record.serial) {
          say('resume-wrong-serial', 'refusal', COPY.resume.wrongSerial);
          return;
        }
        if ((await sha256Hex(bytes)) !== record.backup.sha256) {
          say('resume-wrong-file', 'refusal', COPY.resume.wrongFile);
          return;
        }
      } else if (!parsed.manifest.serial) {
        say('resume-bad-file', 'refusal', COPY.resume.noLocalInfo);
        return;
      }
      setArchive(parsed);
      setResumeFile(file.name);
      setResumeFileOk(true);
      setJournalSerial(parsed.manifest.serial ?? null);
      const rawFrom = parsed.image.get(D890_MAP.LocalInfo, 0x100);
      setFromCode(sanitiseAtD890RangeCode(rawFrom[0x03]!, atD890MaintenanceUnlocked(rawFrom)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeEntry],
  );

  const onResumeVital = useCallback(
    async (file: File | null) => {
      if (!file || !archive) return;
      try {
        const parsed = await parseAtD890VitalZip(new Uint8Array(await file.arrayBuffer()));
        const li = parsed.units['local-info'];
        const tune = parsed.units['tune-a'];
        const want = archive.image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
        if (!li || !tune || !bytesEqual(li.subarray(0, D890_MAP.LocalInfoLength), want)) {
          say('resume-wrong-file', 'refusal', COPY.resume.wrongFile);
          return;
        }
        setBackupTune(tune.slice(0, 0x2000));
        setResumeVital(file.name);
      } catch {
        say('resume-bad-file', 'refusal', COPY.resume.badFile);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [archive],
  );

  const resumeConnect = useCallback(async () => {
    if (!archive) return;
    const serial = archive.manifest.serial!;
    const ent = getRangeChangeJournalEntry(serial);
    const signal = beginBusy();
    try {
      // Same-range check first, with no journal: nothing to finish.
      let session: RadioSession;
      try {
        session = await openSession('restore', true, signal);
      } catch (err) {
        if (isStunKill(err)) sayFailure(err, true);
        else say('no-port', 'warning', COPY.restart.noPort, { details: errMessage(err) });
        return;
      }
      sessionRef.current = session;
      try {
        const live = await identifyRangeChangeRadio(session, { signal });
        if (live.serial !== serial) {
          await releaseHeld(true);
          say('wrong-radio', 'refusal', COPY.resume.wrongRadio(serial, live.serial));
          return;
        }
        setRadio(live);
        const li = archive.image.get(D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
        const zipCode = sanitiseAtD890RangeCode(li[3]!, atD890MaintenanceUnlocked(li));
        const code = ent?.toCode ?? live.identCode;
        if (!ent && live.identCode === zipCode) {
          await releaseHeld(true);
          say('resume-same-range', 'info', COPY.resume.sameRange);
          return;
        }
        setFromCode(zipCode);
        setToCode(code);
        const outcome = await verifyAfterChange(session, {
          serial,
          backupLocalInfo: li,
          backupTune,
          target: code,
          signal,
        });
        const { proceed } = await handleVerify(outcome, live, code, {
          serial,
          stage: ent?.stage ?? null,
        });
        if (proceed || outcome.kind === 'identity-differs') {
          setWiped(true);
          setStep('restart');
        }
      } catch (err) {
        await releaseHeld(!isStunKill(err));
        sayFailure(err, true);
      }
    } finally {
      endBusy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archive, backupTune, egress]);

  // ---- remaining actions ------------------------------------------------------------------------------------

  const resetAll = useCallback(() => {
    setStep('read');
    setNotice(null);
    setRadio(null);
    setTarget(null);
    setPair(null);
    setArchive(null);
    setBackupTune(undefined);
    setBackupPhase('idle');
    setSavedTick(false);
    setConfirmTick(false);
    setVerified(false);
    setChecklist([]);
    setWiped(false);
    setRestoreFailed(false);
    setCheckResult(null);
    setFromCode(null);
    setToCode(null);
    restartCountdown.clear();
    checkCountdown.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cancel(): Promise<void> {
    abortRef.current?.abort();
    // Before the frame: END is safe and the radio restarts by itself.
    await releaseHeld(true);
    navigateInBuild('export');
  }

  async function startAgain(): Promise<void> {
    await releaseHeld(true);
    resetAll();
  }

  function changeBack(): void {
    const from = fromCode;
    if (from === null) return;
    navigateInBuild(`export/danger-zone/frequency-range?target=${from}`);
  }

  const canChangeBack = (): number | null => {
    if (fromCode === null || !radio) return null;
    const t = atD890RangeChangeTargets(toCode ?? radio.identCode, {
      maintenanceUnlocked: radio.maintenanceUnlocked,
    }).find((x) => x.code === fromCode);
    return t && !t.isCurrent && t.available ? fromCode : null;
  };

  function copyDetails(): void {
    const text = notice?.details ?? notice?.body ?? '';
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }

  const restoreAnywayConfirm = (): void => {
    setAnywayOpen(false);
    void runRestore();
  };

  // ---- view -------------------------------------------------------------------------------------------------

  const supported = isRadioSerialSupported();
  const resumeNext: 'connect' | 'check' | null = !archive
    ? null
    : activeEntry?.stage === 'restored'
      ? 'check'
      : 'connect';

  const restoreRows = useMemo(() => {
    const stageIdx = lastStageSeen(progress, COPY.restore.stages.read, COPY.restore.stages.restore);
    return labelledRows(
      [COPY.restore.stages.read, COPY.restore.stages.restore],
      stageIdx,
      progress,
      restoreFinished,
      restoreFailed,
    );
  }, [progress, restoreFinished, restoreFailed]);

  const checkRows = useMemo(
    () => labelledRows([COPY.check.stages.check], 0, progress, checkFinished),
    [progress, checkFinished],
  );

  const backUpRows = useMemo(
    () =>
      labelledRows(
        [COPY.backUp.stages.codeplug, COPY.backUp.stages.vital, COPY.backUp.stages.save],
        phaseIndex,
        progress,
        backupPhase === 'saved',
      ),
    [phaseIndex, progress, backupPhase],
  );

  const backupTime = archive ? clock(archive.manifest.capturedAt) : null;
  const opensSummary =
    radio && target !== null
      ? (() => {
          const s = atD890TxChangeSummary(radio.identCode, target);
          return s.opens.length > 0 ? s.opens.join(' and ') : null;
        })()
      : null;

  const view: RangeChangeView = {
    step,
    busy,
    wiped,
    progress,
    notice,
    supported,
    radio,
    rangeRows,
    target,
    currentCode,
    currentUnlisted,
    rawCodeNote:
      radio && radio.rawCode !== radio.identCode
        ? COPY.read.storedAs(radio.rawCode, radio.identCode)
        : null,
    backUp: {
      phase: backupPhase,
      rows: backUpRows,
      backupName: pair?.backupFileName ?? null,
      vitalName: pair?.vitalFileName ?? null,
      savedTick,
      summary: pair
        ? `${pair.backup.manifest.regions.filter((r) => r.restoreRole === 'restorable').length} regions · serial matches`
        : null,
    },
    confirm: { ticked: confirmTick, receiveOnly, opens: opensSummary },
    restart: {
      secondsLeft: restartCountdown.secondsLeft,
      totalSeconds: COUNTDOWN,
      canReconnect: restartCountdown.secondsLeft === 0 && !busy,
      checklist,
      verified,
      anywayOpen,
      anywayAvailable,
    },
    restore: { rows: restoreRows, failed: restoreFailed, backupTime },
    check: {
      secondsLeft: checkCountdown.secondsLeft,
      totalSeconds: COUNTDOWN,
      rows: checkRows,
      result: checkResult,
    },
    done: { skipped, changeBackCode: canChangeBack() },
    resume: {
      entry: activeEntry,
      choices: fileMode ? [] : choices,
      fileName: resumeFile,
      fileOk: resumeFileOk,
      vitalName: resumeVital,
      next: resumeNext,
    },
    fromCode,
    toCode,
    leaveOpen: opts.leaveOpen ?? false,
  };

  const actions: RangeChangeActions = {
    onConnectRead: () => void connectRead(),
    onReadNext,
    onPickTarget: pickTarget,
    onRangeNext: rangeNext,
    onBackUp: () => void startBackup(),
    onSaveAgain: saveAgain,
    onSavedTick: setSavedTick,
    onBackUpNext: backUpNext,
    onConfirmTick: setConfirmTick,
    onChange: () => void doChange(),
    onCancel: () => void cancel(),
    onStartAgain: () => void startAgain(),
    onReconnect: (force) => void reconnect(force),
    onRestore: () => void runRestore(),
    onRestoreAnywayOpen: () => setAnywayOpen(true),
    onRestoreAnywayClose: () => setAnywayOpen(false),
    onRestoreAnywayConfirm: restoreAnywayConfirm,
    onRestoreAgain: () => void restoreAgain(),
    onCheck: () => void runCheck(),
    onSkipCheck: () => finishDone(true),
    onFinish: () => {
      void releaseHeld(true);
      navigateInBuild('export');
    },
    onBackToExport: () => navigateInBuild('export'),
    onChangeBack: changeBack,
    onCopyDetails: copyDetails,
    onChooseResume: (serial) => setJournalSerial(serial),
    onResumeFile: (f) => void onResumeFile(f),
    onResumeVital: (f) => void onResumeVital(f),
    onResumeConnect: () => void resumeConnect(),
    onResumeToCheck: () => {
      if (!archive) return;
      setNotice(null);
      setToCode(activeEntry?.toCode ?? null);
      setStep('check');
    },
    onResumeFromNotice: (serial) => {
      navigateInBuild('export/danger-zone/frequency-range/resume', { serial });
    },
    onLeaveStay: () => opts.onLeaveStay?.(),
    onLeaveConfirm: () => opts.onLeaveConfirm?.(),
  };

  return { view, actions };
}

function lastStageSeen(progress: ProgressUpdate | null, first: string, second: string): number {
  if (progress?.stage === second) return 1;
  if (progress?.stage === first) return 0;
  return 0;
}
