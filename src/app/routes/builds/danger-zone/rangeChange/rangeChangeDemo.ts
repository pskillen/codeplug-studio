/**
 * Canned views of the Change frequency range wizard for the styleguide (and the PR screenshots): each step, and the
 * main failure screens. Demo data only: a synthetic serial and a demo radio, no owner data.
 */

import type { StageRow } from '../../../../components/builds/RadioIoStageList.tsx';
import type { RangeChangeRadio } from '../../../../services/dangerZone/atD890RangeChangeService.ts';
import { buildRangeRows } from './rangeRows.ts';
import type { RangeChangeActions, RangeChangeNotice, RangeChangeView } from './types.ts';

export const DEMO_SERIAL = 'DEMO0000001A';

const DEMO_RADIO: RangeChangeRadio = {
  serial: DEMO_SERIAL,
  firmware: 'V1.05',
  label: 'Anytone AT-D890UV',
  identCode: 3,
  rawCode: 3,
  maintenanceUnlocked: false,
  localInfo: new Uint8Array(0x100),
};

const noop = (): void => {};

export const DEMO_ACTIONS: RangeChangeActions = {
  onConnectRead: noop,
  onReadNext: noop,
  onPickTarget: noop,
  onRangeNext: noop,
  onBackUp: noop,
  onSaveAgain: noop,
  onSavedTick: noop,
  onBackUpNext: noop,
  onConfirmTick: noop,
  onChange: noop,
  onCancel: noop,
  onStartAgain: noop,
  onReconnect: noop,
  onRestore: noop,
  onRestoreAnywayOpen: noop,
  onRestoreAnywayClose: noop,
  onRestoreAnywayConfirm: noop,
  onRestoreAgain: noop,
  onCheck: noop,
  onSkipCheck: noop,
  onFinish: noop,
  onBackToExport: noop,
  onChangeBack: noop,
  onCopyDetails: noop,
  onChooseResume: noop,
  onResumeFile: noop,
  onResumeVital: noop,
  onResumeConnect: noop,
  onResumeToCheck: noop,
  onResumeFromNotice: noop,
  onLeaveStay: noop,
  onLeaveConfirm: noop,
};

function rows(labels: readonly string[], active: number, done = false): StageRow[] {
  return labels.map((label, i) => ({
    id: `${i}`,
    label,
    weight: 1,
    status: done || i < active ? 'success' : i === active ? 'active' : 'pending',
    ...(i === active && !done ? { fraction: 0.45 } : {}),
  }));
}

const BACKUP_LABELS = [
  'Codeplug and settings',
  'Calibration and identity, read twice and compared',
  'Save both files',
];
const RESTORE_LABELS = ['Preserving live flash', 'Restore'];

function base(): RangeChangeView {
  return {
    step: 'read',
    busy: false,
    wiped: false,
    progress: null,
    notice: null,
    supported: true,
    radio: null,
    rangeRows: [],
    target: null,
    currentCode: null,
    currentUnlisted: false,
    rawCodeNote: null,
    backUp: {
      phase: 'idle',
      rows: rows(BACKUP_LABELS, 0),
      backupName: null,
      vitalName: null,
      savedTick: false,
      summary: null,
    },
    confirm: { ticked: false, receiveOnly: null, opens: null },
    restart: {
      secondsLeft: 0,
      totalSeconds: 60,
      canReconnect: true,
      checklist: [],
      verified: false,
      anywayOpen: false,
      anywayAvailable: false,
    },
    restore: { rows: rows(RESTORE_LABELS, 0), failed: false, backupTime: '14:12' },
    check: { secondsLeft: 0, totalSeconds: 60, rows: rows(['Check'], 0), result: null },
    done: { skipped: false, changeBackCode: null, calibrationChecked: true },
    resume: {
      entry: null,
      choices: [],
      fileName: null,
      fileOk: false,
      vitalName: null,
      next: null,
    },
    fromCode: null,
    toCode: null,
    leaveOpen: false,
  };
}

function withRadio(over: Partial<RangeChangeView>, target: number | null = 7): RangeChangeView {
  return {
    ...base(),
    radio: DEMO_RADIO,
    currentCode: 3,
    fromCode: 3,
    toCode: target,
    target,
    rangeRows: buildRangeRows(3, false),
    ...over,
  };
}

function notice(n: RangeChangeNotice): RangeChangeNotice {
  return n;
}

const CHECKLIST = [
  { id: 'same', text: `Same radio (serial ${DEMO_SERIAL})`, ok: true },
  { id: 'range', text: 'Range is now Amateur US (code 7)', ok: true },
  { id: 'identity', text: 'Identity unchanged apart from the range', ok: true },
  { id: 'calibration', text: 'Calibration unchanged apart from its copy of the range', ok: true },
];

export interface RangeChangeDemoState {
  id: string;
  label: string;
  view: RangeChangeView;
}

export const RANGE_CHANGE_DEMO_STATES: readonly RangeChangeDemoState[] = [
  { id: 'read', label: '1 Read, before', view: base() },
  { id: 'read-done', label: '1 Read, after', view: withRadio({}, null) },
  { id: 'new-range', label: '2 New range', view: withRadio({ step: 'newRange' }) },
  {
    id: 'new-range-unlisted',
    label: '2 New range, unusual code',
    view: withRadio({ step: 'newRange' }, 15),
  },
  {
    id: 'new-range-narrow',
    label: '2 New range, narrower receive',
    view: withRadio({ step: 'newRange' }, 4),
  },
  {
    id: 'back-up-running',
    label: '3 Back up, running',
    view: withRadio({
      step: 'backUp',
      busy: true,
      backUp: { ...base().backUp, phase: 'running', rows: rows(BACKUP_LABELS, 0) },
      progress: { cur: 45, max: 100, msg: 'Reading the radio…' },
    }),
  },
  {
    id: 'back-up-saved',
    label: '3 Back up, files saved',
    view: withRadio({
      step: 'backUp',
      backUp: {
        phase: 'saved',
        rows: rows(BACKUP_LABELS, 0, true),
        backupName: 'radio-backup-AT-D890UV-2026-10-26T14-12-00.zip',
        vitalName: 'd890-vital-2026-10-26T14-12-00.zip',
        savedTick: true,
        summary: '31 regions · serial matches',
      },
    }),
  },
  {
    id: 'back-up-refused',
    label: '3 Back up, refused',
    view: withRadio({
      step: 'backUp',
      notice: notice({
        kind: 'backup-refused',
        tone: 'refusal',
        body: "The two reads of the radio's calibration didn't match, so Studio won't continue. Nothing has changed. Check the cable and try again.",
      }),
    }),
  },
  {
    id: 'confirm',
    label: '4 Confirm',
    view: withRadio({
      step: 'confirm',
      confirm: { ticked: true, receiveOnly: null, opens: '146–148 and 420–430, 440–450 MHz' },
    }),
  },
  {
    id: 'confirm-narrow',
    label: '4 Confirm, narrowing',
    view: withRadio(
      {
        step: 'confirm',
        confirm: { ticked: false, receiveOnly: { count: 12, total: 412 }, opens: null },
      },
      4,
    ),
  },
  {
    id: 'change-running',
    label: '5 Change, running',
    view: withRadio({ step: 'change', busy: true }),
  },
  {
    id: 'change-not-taken',
    label: '5 Change, not taken',
    view: withRadio({
      step: 'change',
      notice: notice({
        kind: 'not-taken',
        tone: 'refusal',
        nothingChanged: true,
        body: "The radio didn't take the change. Nothing has changed. Switch the radio off and on, then try again.",
      }),
    }),
  },
  {
    id: 'restart-waiting',
    label: '6 Restart, waiting',
    view: withRadio({
      step: 'restart',
      wiped: true,
      restart: { ...base().restart, secondsLeft: 42, canReconnect: false },
    }),
  },
  {
    id: 'restart-verified',
    label: '6 Restart, verified',
    view: withRadio({
      step: 'restart',
      wiped: true,
      restart: { ...base().restart, checklist: CHECKLIST, verified: true },
    }),
  },
  {
    id: 'restart-differs',
    label: '6 Restart, identity differs',
    view: withRadio({
      step: 'restart',
      wiped: true,
      restart: {
        ...base().restart,
        checklist: [CHECKLIST[0]!, CHECKLIST[1]!, { ...CHECKLIST[2]!, ok: false }, CHECKLIST[3]!],
        anywayAvailable: true,
      },
      notice: notice({
        kind: 'identity-differs',
        tone: 'refusal',
        body: "Something else in the radio's identity changed (2 bytes). Studio has stopped. Keep both backup files.",
        details: 'demo',
      }),
    }),
  },
  {
    id: 'restore-running',
    label: '7 Restore, running',
    view: withRadio({
      step: 'restore',
      busy: true,
      wiped: true,
      restore: { rows: rows(RESTORE_LABELS, 1), failed: false, backupTime: '14:12' },
      progress: { cur: 45, max: 100, msg: 'Restoring…' },
    }),
  },
  {
    id: 'restore-failed',
    label: '7 Restore, stopped',
    view: withRadio({
      step: 'restore',
      wiped: true,
      restore: {
        rows: rows(RESTORE_LABELS, 1).map((r, i) =>
          i === 1 ? { ...r, status: 'error' as const } : r,
        ),
        failed: true,
        backupTime: '14:12',
      },
      notice: notice({
        kind: 'restore-failed',
        tone: 'refusal',
        body: 'Restore stopped at Restore. The radio may be half restored.',
      }),
    }),
  },
  {
    id: 'check',
    label: '8 Check',
    view: withRadio({ step: 'check' }),
  },
  {
    id: 'check-differs',
    label: '8 Check, differences',
    view: withRadio({
      step: 'check',
      notice: notice({
        kind: 'check-differs',
        tone: 'warning',
        body: "Some of the radio doesn't match the backup (Zones).",
      }),
    }),
  },
  {
    id: 'done',
    label: 'Done',
    view: withRadio({
      step: 'done',
      done: { skipped: false, changeBackCode: 3, calibrationChecked: true },
    }),
  },
  {
    id: 'resume-pick',
    label: 'Resume, pick the file',
    view: withRadio({
      step: 'resume',
      resume: {
        entry: {
          serial: DEMO_SERIAL,
          model: 'AT-D890UV',
          fromCode: 3,
          toCode: 7,
          stage: 'changed',
          backup: {
            fileName: 'radio-backup-AT-D890UV-2026-10-26T14-12-00.zip',
            sha256: '0'.repeat(64),
            savedAt: '2026-10-26T14:12:00.000Z',
          },
          vital: { fileName: 'd890-vital-2026-10-26T14-12-00.zip', sha256: '1'.repeat(64) },
          startedAt: '2026-10-26T14:10:00.000Z',
          updatedAt: '2026-10-26T14:14:00.000Z',
          studioVersion: 'demo',
        },
        choices: [],
        fileName: null,
        fileOk: false,
        vitalName: null,
        next: null,
      },
    }),
  },
];
