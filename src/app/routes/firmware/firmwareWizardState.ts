/**
 * Pure wizard state for the firmware flasher. Holds the operator's choices and the verified, in-memory stock;
 * nothing here is persisted. The flash run itself (progress, outcome) lives in the page.
 */
import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { FirmwareRadioId } from '@core/firmware/types.ts';
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
  /** What to flash. Stock by default: it is always available. */
  readonly choice: FirmwareChoice;
  /** The checked patch for a release or user-patch choice. */
  readonly loadedPatch: LoadedFirmwarePatch | null;
  readonly includeRc: boolean;
  /** "I understand" for an unreviewed user patch. Separate from the preflight risk acknowledgement. */
  readonly riskAccepted: boolean;
  /** Verified stock bytes, in memory only. Kept on back-navigation; cleared when the radio changes. */
  readonly stock: VerifiedStockFirmware | null;
  readonly image: PreparedFirmwareImage | null;
  readonly checks: Readonly<Record<PreflightCheck, boolean>>;
  /** What the selected radio's descriptor asks for on top of the generic checks. */
  readonly radioPreflight: { readonly attestationIds: readonly string[]; readonly probe: boolean };
  readonly radioChecks: Readonly<Record<string, boolean>>;
  /** Set when the radio's normal-mode probe passed. */
  readonly probe: { readonly summary: string } | null;
  /**
   * Opt-in: the operator says they already tested this radio with Studio, so the normal-mode probe may be skipped.
   * UI-level only; the flash send path never reads the probe result.
   */
  readonly probeSkipped: boolean;
}

export type FirmwareWizardAction =
  | {
      type: 'selectRadio';
      radioId: FirmwareRadioId;
      preflight?: { attestationIds: readonly string[]; probe: boolean };
    }
  | { type: 'restart' }
  | { type: 'goTo'; step: FirmwareWizardStep }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'chooseFirmware'; choice: FirmwareChoice; loadedPatch?: LoadedFirmwarePatch | null }
  | { type: 'setIncludeRc'; value: boolean }
  | { type: 'setRiskAccepted'; value: boolean }
  | { type: 'stockVerified'; stock: VerifiedStockFirmware }
  | { type: 'stockCleared' }
  | { type: 'imagePrepared'; image: PreparedFirmwareImage }
  | { type: 'imageCleared' }
  | { type: 'setCheck'; check: PreflightCheck; value: boolean }
  | { type: 'setRadioCheck'; id: string; value: boolean }
  | { type: 'probePassed'; summary: string }
  | { type: 'probeCleared' }
  | { type: 'setProbeSkipped'; value: boolean };

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
  checks: NO_CHECKS,
  radioPreflight: { attestationIds: [], probe: false },
  radioChecks: {},
  probe: null,
  probeSkipped: false,
};

const indexOf = (step: FirmwareWizardStep) => FIRMWARE_WIZARD_STEPS.indexOf(step);

/** A chosen patch is ready: loaded, and accepted when it is unreviewed. */
export function isChoiceReady(state: FirmwareWizardState): boolean {
  if (state.choice.kind === 'stock') return true;
  const loaded = state.loadedPatch;
  if (!loaded) return false;
  return loaded.provenance === 'published' || state.riskAccepted;
}

/** Generic checks ticked, every radio attestation ticked, and the probe passed (or skipped by opt-in) when the radio has one. */
export function isPreflightComplete(state: FirmwareWizardState): boolean {
  return (
    PREFLIGHT_CHECKS.every((c) => state.checks[c]) &&
    state.radioPreflight.attestationIds.every((id) => state.radioChecks[id] === true) &&
    (!state.radioPreflight.probe || state.probe !== null || state.probeSkipped)
  );
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
        loadedPatch: action.choice.kind === 'stock' ? null : (action.loadedPatch ?? null),
        riskAccepted: false,
        image: null,
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
        checks: NO_CHECKS,
        radioChecks: {},
        probe: null,
        probeSkipped: false,
      };
    case 'imagePrepared':
      return { ...state, image: action.image };
    case 'imageCleared':
      return { ...state, image: null };
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
  }
}
