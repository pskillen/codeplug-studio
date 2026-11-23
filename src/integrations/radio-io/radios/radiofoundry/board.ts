/**
 * One radio running RadioFoundry, as the cable protocol sees it.
 * Board numbers (image end, physical base, ID database cap) come from core limits.
 * The protocol and the app take a board; they never name a radio.
 */

import type { RadioFoundryBoardLimits } from '@core/radios/radiofoundry/limits.ts';
import { DM1701_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-1701-radiofoundry/limits.ts';
import { RT84_RADIOFOUNDRY_BOARD } from '@core/radios/retevis/rt84-radiofoundry/limits.ts';
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

/** USB CDC-ACM ignores the line rate; Web Serial still opens the port with one. */
export const RADIOFOUNDRY_USB_BAUD_RATE = 115200;

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

export const DM1701_RADIOFOUNDRY_CABLE_BOARD: RadioFoundryCableBoard = {
  modelId: 'DM-1701-RadioFoundry',
  label: 'Baofeng DM-1701 (RadioFoundry)',
  modelHint: 'DM-1701 RadioFoundry',
  radioIoProfileId: 'radio-io-dm1701-radiofoundry',
  baudRate: RADIOFOUNDRY_USB_BAUD_RATE,
  limits: DM1701_RADIOFOUNDRY_BOARD,
  versionBoardNames: ['DM-1701', 'dm1701'],
  group: 'Baofeng',
};

export const RT84_RADIOFOUNDRY_CABLE_BOARD: RadioFoundryCableBoard = {
  modelId: 'RT84-RadioFoundry',
  label: 'Retevis RT84 (RadioFoundry)',
  modelHint: 'RT84 RadioFoundry',
  radioIoProfileId: 'radio-io-rt84-radiofoundry',
  baudRate: RADIOFOUNDRY_USB_BAUD_RATE,
  limits: RT84_RADIOFOUNDRY_BOARD,
  versionBoardNames: ['DM-1701', 'dm1701'],
  group: 'Retevis',
  /** Hidden on production until a bench write on RadioFoundry. */
  prodWriteDisabled: true,
};

export const RADIOFOUNDRY_CABLE_BOARDS: readonly RadioFoundryCableBoard[] = [
  DM32UV_RADIOFOUNDRY_CABLE_BOARD,
  DM1701_RADIOFOUNDRY_CABLE_BOARD,
  RT84_RADIOFOUNDRY_CABLE_BOARD,
];

/** The board for a radio-io profile id; throws on a non-RadioFoundry id. */
export function radioFoundryCableBoardForProfileId(profileId: string): RadioFoundryCableBoard {
  const board = RADIOFOUNDRY_CABLE_BOARDS.find((row) => row.radioIoProfileId === profileId);
  if (!board) throw new Error(`No RadioFoundry cable board for profile: ${profileId}`);
  return board;
}
