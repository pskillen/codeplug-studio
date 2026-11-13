/**
 * Pure wizard state for the firmware flasher. Holds the operator's choices and the verified, in-memory stock;
 * nothing here is persisted. The flash run itself (progress, outcome) lives in the page.
 */
import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { FirmwareRadioId, RadioInfoAnswers, RadioLayoutAnswer } from '@core/firmware/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { FirmwareChoice, VerifiedStockFirmware } from '../../services/firmwareFlash.ts';

export const FIRMWARE_WIZARD_STEPS = [
  'radio',
  'firmware',
  'stock',
  'prepare',
  'preflight',
  'updateMode',
  'flash',
] as const;

export type FirmwareWizardStep = (typeof FIRMWARE_WIZARD_STEPS)[number];

export const PREFLIGHT_CHECKS = ['risk', 'battery', 'cable', 'otherApps'] as const;
export type PreflightCheck = (typeof PREFLIGHT_CHECKS)[number];

export interface FirmwareWizardState {
  readonly step: FirmwareWizardStep;
  readonly radioId: FirmwareRadioId | null;
  /** What to flash; null until a choice is made when stock flashing is unavailable. */
  readonly choice: FirmwareChoice | null;
  /** The checked patch for a release or user-patch choice. */
  readonly loadedPatch: LoadedFirmwarePatch | null;
  readonly includeRc: boolean;
  /** "I understand" for an unreviewed user patch. Separate from the preflight risk acknowledgement. */
  readonly riskAccepted: boolean;
  /** Verified stock bytes, in memory only. Kept on back-navigation; cleared when the radio changes. */
  readonly stock: VerifiedStockFirmware | null;
  readonly image: PreparedFirmwareImage | null;
  /** The radio's Radio Info lines, for a radio whose stock descriptor asks for its layout. In memory only. */
  readonly radioInfo: RadioInfoAnswers;
  /** What Prepare's read of the radio found, for a radio that may report about itself. In memory only. */
  readonly radioRead: RadioReadStatus | null;
  /**
   * The operator's explicit confirm to write the build the radio already runs (a repair), after reading the updater's
   * warning at Prepare. Cleared whenever the image would change.
   */
  readonly reinstallConfirmed: boolean;
  /**
   * Set once the radio refused the file for one flash layout before installing anything and the operator chose the
   * release's file for the other layout (`from` → `to`). Offered once per flash: while set, no further retry is offered.
   * Prepare uses `to` as the radio's layout. Cleared whenever the choice, stock or radio answers change.
   */
  readonly layoutRetry: { readonly from: string; readonly to: string } | null;
  readonly checks: Readonly<Record<PreflightCheck, boolean>>;
  /** What the selected radio's descriptor asks for on top of the generic checks. */
  readonly radioPreflight: {
    readonly attestationIds: readonly string[];
    readonly probe: boolean;
    /** The radio requires a saved safety backup (never skippable). */
    readonly safetyBackup?: boolean;
  };
  readonly radioChecks: Readonly<Record<string, boolean>>;
  /** Set when the radio's normal-mode probe passed. */
  readonly probe: { readonly summary: string } | null;
  /**
   * Opt-in: the operator says they already tested this radio with Studio, so the normal-mode probe may be skipped.
   * UI-level only; the flash send path never reads the probe result.
   */
  readonly probeSkipped: boolean;
  /** Serial typed from the radio's label, as typed. The backup is filed under its normalised form. */
  readonly safetyBackupSerial: string;
  /**
   * Safety backup status: 'saved' (already recorded, or a file was recorded) or 'taken' (downloaded, waiting for the
   * operator's "I've saved it" tick; `ticked` once recorded). No bytes are held here.
   */
  readonly safetyBackup: SafetyBackupStatus | null;
}

/**
 * The radio report read: a report and what it decides; no report (the Radio Info question is asked); or the read
 * failed (the question is asked, with the reason shown).
 */
export type RadioReadStatus =
  | { readonly kind: 'report'; readonly answer: RadioLayoutAnswer }
  | { readonly kind: 'none' }
  | { readonly kind: 'failed'; readonly message: string };

export type SafetyBackupStatus =
  | { readonly kind: 'saved'; readonly radioKey: string; readonly summary: string }
  | {
      readonly kind: 'taken';
      readonly radioKey: string;
      readonly summary: string;
      readonly region: string;
      readonly fileName: string;
      readonly sha256: string;
      readonly fingerprint: string;
      readonly ticked: boolean;
    };

export type FirmwareWizardAction =
  | {
      type: 'selectRadio';
      radioId: FirmwareRadioId;
      stockFlashOffered?: boolean;
      preflight?: {
        attestationIds: readonly string[];
        probe: boolean;
        safetyBackup?: boolean;
      };
    }
  | { type: 'restart' }
  | { type: 'goTo'; step: FirmwareWizardStep }
  | { type: 'next' }
  | { type: 'back' }
  | {
      type: 'chooseFirmware';
      choice: FirmwareChoice | null;
      loadedPatch?: LoadedFirmwarePatch | null;
    }
  | { type: 'setIncludeRc'; value: boolean }
  | { type: 'setRiskAccepted'; value: boolean }
  | { type: 'stockVerified'; stock: VerifiedStockFirmware }
  | { type: 'stockCleared' }
  | { type: 'imagePrepared'; image: PreparedFirmwareImage }
  | { type: 'imageCleared' }
  | { type: 'setRadioInfo'; patch: Partial<RadioInfoAnswers> }
  | { type: 'radioRead'; status: RadioReadStatus | null }
  | { type: 'setReinstallConfirmed'; value: boolean }
  /**
   * The radio refused the image for `from` before installing anything: swap in `image`, the release's other layout's
   * file, already prepared and checked by the interlocks, and go back to update mode. Keeps the preflight ticks, probe
   * and safety backup; drops the reinstall confirm. Ignored once a retry has been used.
   */
  | { type: 'retryOtherLayout'; from: string; image: PreparedFirmwareImage }
  | { type: 'setCheck'; check: PreflightCheck; value: boolean }
  | { type: 'setRadioCheck'; id: string; value: boolean }
  | { type: 'probePassed'; summary: string }
  | { type: 'probeCleared' }
  | { type: 'setProbeSkipped'; value: boolean }
  | { type: 'setSafetyBackupSerial'; value: string }
  | { type: 'safetyBackupResult'; status: SafetyBackupStatus }
  | { type: 'safetyBackupTicked' }
  | { type: 'safetyBackupCleared' };

const NO_CHECKS: Record<PreflightCheck, boolean> = {
  risk: false,
  battery: false,
  cable: false,
  otherApps: false,
};

const STOCK_CHOICE: FirmwareChoice = { kind: 'stock' };

export const INITIAL_FIRMWARE_WIZARD_STATE: FirmwareWizardState = {
  step: 'radio',
  radioId: null,
  choice: STOCK_CHOICE,
  loadedPatch: null,
  includeRc: false,
  riskAccepted: false,
  stock: null,
  image: null,
  radioInfo: { firmware: '', hardware: '', suffix: '' },
  radioRead: null,
  reinstallConfirmed: false,
  layoutRetry: null,
  checks: NO_CHECKS,
  radioPreflight: { attestationIds: [], probe: false },
  radioChecks: {},
  probe: null,
  probeSkipped: false,
  safetyBackupSerial: '',
  safetyBackup: null,
};

const indexOf = (step: FirmwareWizardStep) => FIRMWARE_WIZARD_STEPS.indexOf(step);

/**
 * A chosen patch is ready: loaded, and accepted when it is unreviewed. A to-stock patch needs no risk tick: its
 * radio's interlocks hold it to the stock bytes and a pinned loader, so what it installs is known.
 */
export function isChoiceReady(state: FirmwareWizardState): boolean {
  if (!state.choice) return false;
  if (state.choice.kind === 'stock') return true;
  const loaded = state.loadedPatch;
  if (!loaded) return false;
  if (state.choice.kind === 'back-to-stock') return true;
  return loaded.provenance === 'published' || state.riskAccepted;
}

/** Generic checks ticked, every radio attestation ticked, and the probe passed (or skipped by opt-in) when the radio has one. */
export function isPreflightComplete(state: FirmwareWizardState): boolean {
  return (
    PREFLIGHT_CHECKS.every((c) => state.checks[c]) &&
    state.radioPreflight.attestationIds.every((id) => state.radioChecks[id] === true) &&
    (!state.radioPreflight.probe || state.probe !== null || state.probeSkipped) &&
    (!state.radioPreflight.safetyBackup || isSafetyBackupDone(state))
  );
}

/** Recorded already, or a taken backup the operator ticked as saved. The probe opt-out never counts. */
export function isSafetyBackupDone(state: FirmwareWizardState): boolean {
  const sb = state.safetyBackup;
  return sb !== null && (sb.kind === 'saved' || sb.ticked);
}

/** Whether the operator may move past `state.step`. */
export function canAdvance(state: FirmwareWizardState): boolean {
  switch (state.step) {
    case 'radio':
      return state.radioId !== null;
    case 'firmware':
      return state.radioId !== null && isChoiceReady(state);
    case 'stock':
      return state.stock !== null;
    case 'prepare':
      return state.image !== null;
    case 'preflight':
      return isPreflightComplete(state);
    case 'updateMode':
      return true;
    case 'flash':
      return false;
  }
}

/** Steps before `step` must all be satisfiable for a jump to `step` to be allowed. */
function reachable(state: FirmwareWizardState, step: FirmwareWizardStep): boolean {
  for (let i = 0; i < indexOf(step); i++) {
    if (!canAdvance({ ...state, step: FIRMWARE_WIZARD_STEPS[i]! })) return false;
  }
  return true;
}

export function firmwareWizardReducer(
  state: FirmwareWizardState,
  action: FirmwareWizardAction,
): FirmwareWizardState {
  switch (action.type) {
    case 'selectRadio':
      if (action.radioId === state.radioId) return state;
      return {
        ...INITIAL_FIRMWARE_WIZARD_STATE,
        radioId: action.radioId,
        choice: action.stockFlashOffered === false ? null : STOCK_CHOICE,
        includeRc: state.includeRc,
        radioPreflight: action.preflight ?? INITIAL_FIRMWARE_WIZARD_STATE.radioPreflight,
      };
    case 'restart':
      return INITIAL_FIRMWARE_WIZARD_STATE;
    case 'goTo':
      return reachable(state, action.step) ? { ...state, step: action.step } : state;
    case 'next': {
      if (!canAdvance(state)) return state;
      const next = FIRMWARE_WIZARD_STEPS[indexOf(state.step) + 1];
      return next ? { ...state, step: next } : state;
    }
    case 'back': {
      const prev = FIRMWARE_WIZARD_STEPS[indexOf(state.step) - 1];
      return prev ? { ...state, step: prev } : state;
    }
    case 'chooseFirmware':
      // A new choice means a new image: keep the verified stock, drop everything built from the old choice.
      return {
        ...state,
        choice: action.choice,
        loadedPatch:
          !action.choice || action.choice.kind === 'stock' ? null : (action.loadedPatch ?? null),
        riskAccepted: false,
        image: null,
        reinstallConfirmed: false,
        layoutRetry: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'setIncludeRc':
      return { ...state, includeRc: action.value };
    case 'setRiskAccepted':
      return { ...state, riskAccepted: action.value };
    case 'stockVerified':
      return {
        ...state,
        stock: action.stock,
        image: null,
        reinstallConfirmed: false,
        layoutRetry: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'stockCleared':
      return {
        ...state,
        stock: null,
        image: null,
        reinstallConfirmed: false,
        layoutRetry: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'imagePrepared':
      return { ...state, image: action.image };
    case 'imageCleared':
      return { ...state, image: null };
    case 'setRadioInfo':
      // A new layout means a new image and fresh checks.
      return {
        ...state,
        radioInfo: { ...state.radioInfo, ...action.patch },
        image: null,
        reinstallConfirmed: false,
        layoutRetry: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'radioRead':
      // A new read (or a cleared one) may mean a new layout or build: a new image and fresh checks.
      return {
        ...state,
        radioRead: action.status,
        image: null,
        reinstallConfirmed: false,
        layoutRetry: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'setReinstallConfirmed':
      // The confirm is part of the image: a change rebuilds it, and the checks start again.
      if (action.value === state.reinstallConfirmed) return state;
      return {
        ...state,
        reinstallConfirmed: action.value,
        image: null,
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'retryOtherLayout': {
      // Once per flash, and only to an image prepared for a layout other than the refused one.
      const to = action.image.radioLayout;
      if (state.layoutRetry || !to || to === action.from) return state;
      return {
        ...state,
        step: 'updateMode',
        image: action.image,
        reinstallConfirmed: false,
        layoutRetry: { from: action.from, to },
      };
    }
    case 'setCheck':
      return { ...state, checks: { ...state.checks, [action.check]: action.value } };
    case 'setRadioCheck':
      return { ...state, radioChecks: { ...state.radioChecks, [action.id]: action.value } };
    case 'probePassed':
      return { ...state, probe: { summary: action.summary } };
    case 'probeCleared':
      return { ...state, probe: null };
    case 'setProbeSkipped':
      return { ...state, probeSkipped: action.value };
    case 'setSafetyBackupSerial':
      // A result belongs to one serial: typing another discards it.
      return action.value === state.safetyBackupSerial
        ? state
        : { ...state, safetyBackupSerial: action.value, safetyBackup: null };
    case 'safetyBackupResult':
      return { ...state, safetyBackup: action.status };
    case 'safetyBackupTicked':
      return state.safetyBackup?.kind === 'taken'
        ? { ...state, safetyBackup: { ...state.safetyBackup, ticked: true } }
        : state;
    case 'safetyBackupCleared':
      return { ...state, safetyBackup: null };
  }
}
