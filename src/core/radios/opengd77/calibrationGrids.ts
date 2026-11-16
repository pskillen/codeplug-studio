/**
 * The frequency grids the OpenGD77 firmware itself uses to look up the calibration working copy
 * (DM-1701 family and MD-9600): where each table's points sit in MHz. They come from the firmware
 * consumers (`trx.c`, `calibration.c`), not from the inferred stock frequency-point table at
 * 0x100 / 0x1B0 (`calibration.ts`, `partly` confidence), so they hold even where that table is
 * overwritten by the local marker. Reference: "Frequency grids the consumers use" in
 * docs/reference/radios/baofeng/dm-1701/calibration.md and
 * docs/reference/radios/tyt/md-9600/calibration.md.
 *
 * The stock squelch, CTCSS and DCS rows have no stated grid and no consumer; they are not here.
 */

export interface OpenGd77CalibrationGrids {
  /** UHF points (9): 400 to 480 MHz every 10 MHz in both models. */
  uhf: readonly number[];
  /** VHF power points (5). */
  vhfPower: readonly number[];
  /** VHF I/Q gain and RX tuning points (5), `calIQTableMinFreq`. */
  vhfTuning: readonly number[];
  /** Where each grid was traced to. */
  evidence: { power: string; tuning: string };
}

const UHF_GRID = [400, 410, 420, 430, 440, 450, 460, 470, 480] as const;
const VHF_TUNING_GRID = [136, 145.5, 155, 164.5, 174] as const;

export const OPENGD77_DM1701_CALIBRATION_GRIDS: OpenGd77CalibrationGrids = {
  uhf: UHF_GRID,
  vhfPower: [135, 145, 155, 165, 175],
  vhfTuning: VHF_TUNING_GRID,
  evidence: { power: 'trx.c:62-81, calibration.c:486-596', tuning: 'calibration.c:243-471' },
};

export const OPENGD77_MD9600_CALIBRATION_GRIDS: OpenGd77CalibrationGrids = {
  uhf: UHF_GRID,
  vhfPower: [136, 145.5, 155, 164.5, 174],
  vhfTuning: VHF_TUNING_GRID,
  evidence: { power: 'trx.c:60-76, calibration.c:436-553', tuning: 'calibration.c:243-471' },
};
