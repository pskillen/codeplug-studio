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
}

export type FirmwareWizardAction =
  | { type: 'selectRadio'; radioId: FirmwareRadioId }
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
  | { type: 'setCheck'; check: PreflightCheck; value: boolean };

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
};

const indexOf = (step: FirmwareWizardStep) => FIRMWARE_WIZARD_STEPS.indexOf(step);

/** A chosen patch is ready: loaded, and accepted when it is unreviewed. */
export function isChoiceReady(state: FirmwareWizardState): boolean {
  if (state.choice.kind === 'stock') return true;
  const loaded = state.loadedPatch;
  if (!loaded) return false;
  return loaded.provenance === 'bundled' || state.riskAccepted;
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
      return PREFLIGHT_CHECKS.every((c) => state.checks[c]);
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
      };
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
      };
    case 'setIncludeRc':
      return { ...state, includeRc: action.value };
    case 'setRiskAccepted':
      return { ...state, riskAccepted: action.value };
    case 'stockVerified':
      return { ...state, stock: action.stock, image: null, checks: NO_CHECKS };
    case 'stockCleared':
      return { ...state, stock: null, image: null, checks: NO_CHECKS };
    case 'imagePrepared':
      return { ...state, image: action.image };
    case 'imageCleared':
      return { ...state, image: null };
    case 'setCheck':
      return { ...state, checks: { ...state.checks, [action.check]: action.value } };
  }
}
