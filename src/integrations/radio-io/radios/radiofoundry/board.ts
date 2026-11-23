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
  /** Manufacturer group for the radio picker (descriptor `group`). */
  group: string;
  /** Hide cable Write on production deploys until this board has been bench-written. */
  prodWriteDisabled?: boolean;
  /**
   * VERSION `board=` values that mean this board, from upstream's registry (tools/boards.py debuglink_names at
   * 454a5b76): the board name, older aliases and the board id.
   */
  versionBoardNames: readonly string[];
}

export const DM32UV_RADIOFOUNDRY_CABLE_BOARD: RadioFoundryCableBoard = {
  modelId: DM32_RADIOFOUNDRY_MODEL_ID,
  label: 'Baofeng DM-32UV (RadioFoundry)',
  modelHint: 'DM-32UV RadioFoundry',
  radioIoProfileId: DM32_RADIOFOUNDRY_PROFILE_ID,
  baudRate: DM32_RADIOFOUNDRY_BAUD_RATE,
  limits: DM32UV_RADIOFOUNDRY_BOARD,
  group: 'Baofeng',
  versionBoardNames: ['DM-32UV', 'DM-32', 'dm32'],
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
