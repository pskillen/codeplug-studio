/**
 * Pure wizard state for the firmware flasher. Holds the operator's choices and the verified, in-memory stock;
 * nothing here is persisted. The flash run itself (progress, outcome) lives in the page.
 */
import type { FirmwareRadioId } from '@core/firmware/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import type { VerifiedStockFirmware } from '../../services/firmwareFlash.ts';

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

export const INITIAL_FIRMWARE_WIZARD_STATE: FirmwareWizardState = {
  step: 'radio',
  radioId: null,
  stock: null,
  image: null,
  checks: NO_CHECKS,
};

const indexOf = (step: FirmwareWizardStep) => FIRMWARE_WIZARD_STEPS.indexOf(step);

/** Whether the operator may move past `state.step`. */
export function canAdvance(state: FirmwareWizardState): boolean {
  switch (state.step) {
    case 'radio':
      return state.radioId !== null;
    case 'firmware':
      return state.radioId !== null;
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
      return { ...INITIAL_FIRMWARE_WIZARD_STATE, radioId: action.radioId };
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
