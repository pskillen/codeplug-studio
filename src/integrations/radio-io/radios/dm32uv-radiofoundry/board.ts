/**
 * One radio running RadioFoundry, as the cable protocol sees it.
 * Board numbers (image end, physical base, ID database cap) come from core limits.
 * The protocol and the app take a board; they never name a radio.
 */

import type { RadioFoundryBoardLimits } from '@core/radios/radiofoundry/limits.ts';
import { DM32UV_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import {
  DM32_RADIOFOUNDRY_BAUD_RATE,
  DM32_RADIOFOUNDRY_MODEL_ID,
  DM32_RADIOFOUNDRY_PROFILE_ID,
} from './constants.ts';

export interface RadioFoundryCableBoard {
  /** Hydration and descriptor model id. */
  modelId: string;
  /** Descriptor label. */
  label: string;
  /** Reported in `IdentResult.modelHints`. */
  modelHint: string;
  /** The radio-io egress profile this board serves. */
  radioIoProfileId: string;
  baudRate: number;
  limits: RadioFoundryBoardLimits;
}

export const DM32UV_RADIOFOUNDRY_CABLE_BOARD: RadioFoundryCableBoard = {
  modelId: DM32_RADIOFOUNDRY_MODEL_ID,
  label: 'Baofeng DM-32UV (RadioFoundry)',
  modelHint: 'DM-32UV RadioFoundry',
  radioIoProfileId: DM32_RADIOFOUNDRY_PROFILE_ID,
  baudRate: DM32_RADIOFOUNDRY_BAUD_RATE,
  limits: DM32UV_RADIOFOUNDRY_BOARD,
};

export const RADIOFOUNDRY_CABLE_BOARDS: readonly RadioFoundryCableBoard[] = [
  DM32UV_RADIOFOUNDRY_CABLE_BOARD,
];

/** The board for a radio-io profile id; throws on a non-RadioFoundry id. */
export function radioFoundryCableBoardForProfileId(profileId: string): RadioFoundryCableBoard {
  const board = RADIOFOUNDRY_CABLE_BOARDS.find((row) => row.radioIoProfileId === profileId);
  if (!board) throw new Error(`No RadioFoundry cable board for profile: ${profileId}`);
  return board;
}
