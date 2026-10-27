/**
 * Owner decisions for the Danger zone (2026-10-26). One place to flip each. Interlocks (target allow-list, code 14
 * only with `890#`, frame shape) never read this file.
 *
 * Q7 (no prod gate, no feature flag; testing happens on pre-prod) is the absence of any gate: the registry has no
 * `prodDisabled` and nothing hides the area by build environment.
 *
 * `areaName` is the one name for the area: the page title, the Export card, its button and the Radio settings
 * pointer are all built from it. `strap` is read by the area page. The rest is read by the Change
 * frequency range wizard.
 */
export const DANGER_ZONE_DECISIONS = {
  /** Q1: the area's name. */
  areaName: 'Danger zone',
  /** Q1: the fixed red strap under the title. */
  strap: "These change the radio itself. A Write can't undo them.",

  // --- Wizard (PR 4) ---
  /** Q2: Confirm is a checkbox plus a button. No typed confirm, no hold-to-confirm. */
  confirmStyle: 'checkbox-and-button',
  /** Q3: show every range. No "Show narrower ranges" toggle. */
  showNarrowerRangesToggle: false,
  /**
   * Q4 (coordinator call): code 14 is listed but disabled unless the radio already has `890#`, with a one-line
   * reason. Without `890#` the loader maps 14 to 0 and the change would land on Commercial Europe for nothing.
   * The `890#` check is an interlock (code), not this flag.
   */
  code14: 'listed-disabled-without-890',
  /** Q5: the backup check is a tickbox, "I've saved both files". No re-open step. */
  backupCheck: 'tickbox',
  backupCheckLabel: "I've saved both files",
  /** Q6: Restore anyway stays, behind a second confirm. */
  restoreAnywayBehindSecondConfirm: true,
  /**
   * Q8: codes 6, 9, 12 and 15 are allowed behind a big, scary warning (firmware-valid; not offered by the CPS or
   * the factory menu). Applies to a radio currently on one of them and to choosing one as the target.
   */
  unlistedCodes: { codes: [6, 9, 12, 15], policy: 'allow-with-scary-warning' },
  /** Q9: the final Check is never automatic. The user clicks it; Skip stays available. */
  finalCheckAutomatic: false,
  /** RT-2 sets this: how long the restart steps count down before Reconnect and Check are offered. */
  restartCountdownSeconds: 60,
  /**
   * RT-8 decides: what the Check step says when the radio shows "Program Error". `stay-connected` tells the user
   * to leave it on and press Restore again; `initialise-first` tells them to choose Initialize on the radio first.
   */
  programErrorAdvice: 'stay-connected',
} as const;
