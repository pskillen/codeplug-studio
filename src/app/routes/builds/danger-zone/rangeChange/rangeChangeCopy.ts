/**
 * Every user-facing string of the Change frequency range wizard (design §6, with the owner decisions of
 * 2026-10-26 applied), in one place. No firmware internals: no addresses, hooks or byte offsets.
 */

import {
  AT_D890_FREQUENCY_RANGES,
  describeAtD890FrequencyRange,
} from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import { DANGER_ZONE_DECISIONS } from '../../../../services/dangerZone/decisions.ts';

export const NOTHING_CHANGED = 'Nothing has changed.';

/** "Amateur Europe (code 3)". Unlisted codes read "Unlisted range (code 15)". */
export function rangeLabel(code: number): string {
  const row = AT_D890_FREQUENCY_RANGES.find((r) => r.code === code);
  return row ? `${row.caption} (code ${code})` : `Unknown range (code ${code})`;
}

/** "Amateur Europe" without the code. */
export function rangeCaption(code: number): string {
  return AT_D890_FREQUENCY_RANGES.find((r) => r.code === code)?.caption ?? `Code ${code}`;
}

export function txText(code: number): string {
  return describeAtD890FrequencyRange(code).txSummary;
}

export function rxText(code: number): string {
  return describeAtD890FrequencyRange(code).rxSummary;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dayAndClock(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${clock(iso)}`;
}

/** The last 4 characters of a serial. */
export function tail4(serial: string): string {
  return serial.length > 4 ? `…${serial.slice(-4)}` : serial;
}

export const STEP_LABELS = {
  read: 'Read',
  newRange: 'New range',
  backUp: 'Back up',
  confirm: 'Confirm',
  change: 'Change',
  restart: 'Restart',
  restore: 'Restore',
  check: 'Check',
} as const;

export const COPY = {
  title: 'Change frequency range',
  strap: DANGER_ZONE_DECISIONS.strap,
  notRunOnRadio: 'Not yet checked on a radio.',

  read: {
    intro: 'Connect the radio you want to change. Studio reads who it is. Nothing is written.',
    button: 'Connect & read',
    reading: 'Reading the radio…',
    storedAs: (raw: number, sanitised: number) =>
      `Stored as ${raw}; the radio treats it as ${sanitised}.`,
    unlistedCurrent: (code: number) =>
      `This radio is set to a range the official software doesn't offer (code ${code}). Studio can still change it, but that range is unusual: be sure it's the radio you mean to change.`,
  },

  newRange: {
    intro: 'Pick the range the radio should use. The current one is ticked.',
    current: 'Current',
    wider: 'wider',
    narrower: 'narrower',
    different: 'different',
    uhfOff: 'Transmit: VHF only',
    receiveSame: 'Receive stays the same.',
    notOffered: 'Not offered by the official software',
    code14Reason:
      'Needs the maintenance password (890#) already set on this radio. Without it the radio treats code 14 as 0, so the change would land on Commercial Europe and wipe the radio for nothing.',
    regulatory:
      "Only transmit where your licence allows. A wider range doesn't change your licence, and may take the radio outside its type approval. That's on you.",
    narrow:
      'These also narrow what the radio can receive. Channels outside it stop working, and some restored settings may not suit them.',
    unlistedTitle: 'Unusual range',
    unlistedTarget: (code: number) =>
      `Code ${code} is valid to the radio's firmware, but neither the official software nor the radio's own menu offers it. Nobody has checked what it does on a real radio. Only choose it if you know why you need it.`,
    next: 'Next: back up',
  },

  backUp: {
    intro:
      "Studio now reads the whole radio and saves two files. Keep them until you've finished: they're how you get your channels and settings back.",
    start: 'Back up the radio',
    stages: {
      codeplug: 'Codeplug and settings',
      vital: 'Calibration and identity, read twice and compared',
      save: 'Save both files',
    },
    saved: 'Both files were saved to your computer.',
    saveAgain: 'Save again',
    tickLabel: DANGER_ZONE_DECISIONS.backupCheckLabel,
    tickHelp: 'Look in your downloads folder. The browser can’t tell Studio the files were kept.',
    next: 'Next: confirm',
    failed: `The backup didn't finish. ${NOTHING_CHANGED}`,
    reasons: {
      'reads-differ':
        "The two reads of the radio's calibration didn't match, so Studio won't continue. " +
        `${NOTHING_CHANGED} Check the cable and try again.`,
      'blank-serial': `Studio can't read this radio's serial number, so it couldn't match the backup later. It won't continue. ${NOTHING_CHANGED}`,
      'identity-wrong': `This radio's identity looks wrong, so Studio won't change it. ${NOTHING_CHANGED}`,
    },
    tryAgain: 'Try again',
    backupLabel: 'Backup',
    vitalLabel: 'Vital data',
    sessionNote: 'before range change',
  },

  confirm: {
    heading: (name: string, serial: string, from: string, to: string) =>
      `Change ${name} (serial ${serial}) from ${from} to ${to}`,
    points: [
      'Studio changes one setting on the radio.',
      "The radio restarts and wipes its channels, zones, scan lists and settings. That's how the radio works; the official software can't avoid it either.",
      'Studio puts them back from the backup you just saved.',
    ],
    until:
      'Until step 3 finishes, the radio has no channels. If anything stops, you can resume from your backup file, even after closing this page.',
    receiveOnly: (n: number, total: number, range: string) =>
      `${n} of the radio's ${total} channels will be receive-only on ${range}.`,
    opens: (spans: string) => `Transmit opens on ${spans} MHz.`,
    tick: 'I understand the radio will be wiped and restored from my backup.',
    button: 'Change frequency range',
    cancel: 'Cancel',
    unlisted: (code: number) =>
      `Code ${code} is an unusual range that nobody has checked on a real radio.`,
  },

  change: {
    running: 'Changing the range. Keep the radio switched on and connected.',
    radioChanged: `The radio changed since the backup. Studio has stopped. ${NOTHING_CHANGED}`,
    refused: (detail: string) =>
      `Studio stopped before changing anything. ${detail} ${NOTHING_CHANGED}`,
    notTaken: `The radio didn't take the change. ${NOTHING_CHANGED} Switch the radio off and on, then try again.`,
    startAgain: 'Start again',
    unreadable:
      "Studio couldn't read the radio's identity, so it stopped without changing anything. Switch the radio off and on, then try again.",
    unknown:
      'Studio stopped and cannot tell what the radio did. Switch it off and on. If it starts with no channels, use Resume from the Danger zone with your backup file.',
  },

  refusal: {
    notD890: "This isn't an AT-D890UV. Studio has stopped.",
    stunKill:
      'This radio is flagged as stunned or killed. Studio has stopped and changed nothing. Switch it off and on, then try again.',
    unreadableNoEnd:
      "Studio couldn't read the radio's identity, so it can't tell whether the radio is safe to leave. It stopped without changing anything and sent nothing more. Switch the radio off and on, then try again.",
    lost: 'Lost the connection to the radio.',
    lostBefore: NOTHING_CHANGED,
    lostAfter: 'Your radio may be wiped.',
  },

  restart: {
    intro:
      'The radio is restarting and wiping its channels and settings. This is expected. It takes about a minute.',
    waiting: 'Waiting for the radio to restart',
    reconnect: 'Reconnect',
    choosePort: 'Choose the port…',
    afterCount:
      "The radio applies the change and restarts. Its screen may stay on 'PC Read'. Continue when Reconnect lights up or the countdown ends. If the browser asks which port to use, pick the radio.",
    noPort:
      "Can't see the radio yet. Give it a little longer (its screen may stay on 'PC Read'), then unplug and replug the cable and press Reconnect.",
    wrongRadio: (found: string, want: string) =>
      `This isn't the radio you changed (serial ${found}). Plug in the one with serial ${want}.`,
    checklist: {
      same: (serial: string) => `Same radio (serial ${serial})`,
      range: (label: string) => `Range is now ${label}`,
      identity: 'Identity unchanged apart from the range',
      calibration: 'Calibration unchanged apart from its copy of the range',
      calibrationSkipped: 'Calibration not compared (no vital file picked)',
    },
    restoreButton: 'Restore my backup',
    stillOld: (label: string) =>
      `The radio is still on ${label}. The change didn't take, and nothing was wiped.`,
    tryAgain: 'Try again',
    finish: 'Finish',
    unexpected: (code: number) =>
      `The radio reports an unexpected range (code ${code}). Studio has stopped. Keep your backup files.`,
    identityDiffers: (n: number) =>
      `Something else in the radio's identity changed (${n} byte${n === 1 ? '' : 's'}). Studio has stopped. Keep both backup files.`,
    copyDetails: 'Copy details',
    restoreAnyway: 'Restore my channels anyway…',
    anywayTitle: 'Restore your channels anyway?',
    anywayBody:
      "The radio's identity or calibration differs from the backup beyond the range. Restore never writes those, so your channels and settings can still be put back. But something unexpected happened, so only go on if you know what changed.",
    anywayConfirm: 'Restore anyway',
    programError:
      'If the radio shows Program Error, leave it on and connected and press Restore my backup.',
  },

  restore: {
    running: (time: string) =>
      `Putting your channels and settings back from the backup saved at ${time}. Keep this page open. If it stops, start it again: it's safe to repeat.`,
    stopped: (stage: string) =>
      `Restore stopped${stage ? ` at ${stage}` : ''}. The radio may be half restored.`,
    again: 'Restore again',
    leave: 'Your radio is wiped until Restore finishes. Leave anyway?',
    leaveTitle: 'Leave this page?',
    leaveConfirm: 'Leave anyway',
    stay: 'Stay',
    stages: { read: 'Preserving live flash', restore: 'Restore' },
  },

  check: {
    intro:
      "The radio is restarting again. Its screen may stay on 'PC Read'. Press Check when the countdown ends.",
    waitDone: 'The countdown has ended. Press Check.',
    usageChanges: (labels: string) =>
      `Changed since the restore, which is normal if you've used the radio: ${labels}.`,
    button: 'Check',
    skip: 'Skip check',
    stages: { check: 'Check' },
    okChannels: 'Channels, zones and scan lists match the backup',
    okSettings: 'Radio settings and APRS match the backup',
    differences: (labels: string) => `Some of the radio doesn't match the backup (${labels}).`,
    programErrorStay:
      "If the radio shows Program Error / Please Initialize The Radio!, don't initialise it. Leave it on and connected and press Restore again.",
    programErrorInit:
      'If the radio shows Program Error / Please Initialize The Radio!, choose Initialize on the radio, then press Restore again.',
  },

  done: {
    heading: (name: string, range: string) => `Done. ${name} is now on ${range}.`,
    putBack: 'Put back',
    putBackItems: [
      'Channels, zones, scan lists and zone names',
      'All radio settings and APRS',
      'VFO A and B, the DTMF list and beacon names',
    ],
    calibrationTitle: 'Calibration',
    calibration: 'Rewritten by the radio, checked unchanged.',
    calibrationNotCompared: 'Rewritten by the radio. Studio did not compare it with the backup.',
    cpsTitle: 'Official CPS',
    cps: "Files saved before today won't write to this radio (Band Error!). In the CPS, read the radio first, then save a new file.",
    keep: "Keep both backup files. They're your copy of the radio before the change.",
    back: 'Back to Export',
    changeBack: (label: string) => `Change back to ${label}…`,
    notChecked: 'The final check was skipped.',
  },

  resume: {
    title: 'Finish a range change',
    pick: (time: string, name: string) => `Pick the backup you saved at ${time} (${name}).`,
    pickNoJournal:
      'Pick the backup file you saved before the range change. Studio checks it against the radio you connect.',
    pickButton: 'Choose backup file…',
    pickVital: 'Choose vital file (optional)…',
    vitalHelp: 'Pick the vital file as well to also check the calibration.',
    connect: 'Connect & read',
    toCheck: 'Go to Check',
    wrongFile:
      'That is not the backup Studio saved for this change. Pick the file saved at the time shown.',
    wrongSerial: "That backup is from a different radio than the one you're finishing.",
    badFile: "Studio couldn't open that file as a radio backup.",
    notD890: 'That backup is not from an AT-D890UV.',
    noLocalInfo: "That backup doesn't hold the radio's identity, so Studio can't use it here.",
    sameRange:
      "This radio's range already matches the backup. Use Backup / Restore for a normal restore.",
    nothingChanged: `Nothing changed after all. ${NOTHING_CHANGED} The radio is still on its old range.`,
    wrongRadio: (want: string, found: string) =>
      `This isn't the radio from the backup (serial ${want}). The connected radio has serial ${found}.`,
    none: 'There is no unfinished range change on record in this browser.',
    choose: 'Which radio?',
  },

  banner: {
    sending: (name: string, serial: string, range: string, time: string) =>
      `Unfinished range change. ${name} (${serial}) was changed to ${range} at ${time} and hasn't been restored. Its channels and settings may be wiped.`,
    restored: (name: string, serial: string, range: string, time: string) =>
      `Unfinished range change. ${name} (${serial}) was changed to ${range} at ${time} and restored, but not checked.`,
    resume: 'Resume',
    check: 'Check',
    dismiss: 'Dismiss this record',
    dismissTitle: 'Forget this range change?',
    dismissBody:
      'Studio will forget its record of this change: this banner and Resume go away. The radio isn\'t touched, so if it is still wiped it stays wiped, and Studio can no longer finish the change for you from this record. Your backup files are not deleted, and you can still use "Finish a range change from a backup file".',
    dismissConfirm: 'Forget this record',
    dismissCancel: 'Keep it',
  },

  footer: {
    fromFile: 'Finish a range change from a backup file',
    last: (tail: string, from: string, to: string, when: string) =>
      `Last change: ${tail}, ${from} → ${to}, ${when}`,
    changeBack: 'Change back…',
  },

  guardRestoreMismatch:
    "This radio's range has changed since the backup, so Studio restores everything together. Restoring settings alone would stop the radio starting.",
} as const;
